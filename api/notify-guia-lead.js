/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — CAPTURA DO "GUIA GRATUITO" (lead magnet)
 * ============================================================================
 * Chamada pelo frontend (`guiaLeadService.ts`) quando alguém baixa algum dos
 * guias gratuitos em PDF do site. Faz duas coisas, em paralelo, cada uma
 * independente da outra:
 *   1. Envia um e-mail simples para o Gabriel avisando do novo interessado.
 *   2. Grava o registro numa tabela própria do Supabase (`guia_leads`),
 *      separada da tabela `leads` do funil principal — este contato ainda
 *      não fez uma simulação completa.
 *
 * Mesmas variáveis de ambiente de `api/notify-lead.js` (RESEND_API_KEY,
 * LEAD_NOTIFICATION_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Se
 * alguma integração não estiver configurada, essa parte é pulada sem erro —
 * o download do guia no site nunca depende desta função.
 * ============================================================================
 */

const DEFAULT_NOTIFICATION_EMAIL = 'comercial.mfzeng@gmail.com';

const MATERIAIS = {
  'guia-caminho-regularizacao': 'O caminho da regularização da sua obra',
};

function materialLabel(material) {
  return MATERIAIS[material] || MATERIAIS['guia-caminho-regularizacao'];
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `guia_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Monta o link de WhatsApp pronto pra o Gabriel chamar o contato, com uma
 * mensagem já preenchida com o nome dele. Diferente do link usado no e-mail
 * de simulação (que já sabe o valor de economia) — aqui a pessoa ainda não
 * simulou nada, só baixou o guia gratuito, então a mensagem convida pra dar
 * o próximo passo em vez de citar um número.
 */
function buildWhatsAppLink(guiaLead) {
  const digits = onlyDigits(guiaLead.whatsapp);
  if (!digits) return null;
  const numero = digits.length <= 11 ? `55${digits}` : digits;
  const nome = guiaLead.nome || '';
  const material = materialLabel(guiaLead.material);

  const texto = `Oi ${nome}, tudo bem? Aqui é o Gabriel. Vi que você baixou o guia "${material}" — isso costuma ser sinal de que tem uma obra pra regularizar. Posso te ajudar a entender o seu caso? Se quiser, dá pra fazer uma simulação rápida no site e já ver uma estimativa de economia, ou posso te explicar direto por aqui como funciona.`;

  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Roteiro rápido pro Gabriel seguir de acordo com a resposta do contato no
 * WhatsApp. Uso interno, nunca aparece pro cliente.
 */
function buildRoteiroHtml() {
  return `
    <div style="margin:16px 0 0;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
      <p style="margin:0 0 8px;font-weight:700;color:#1e3a8a;font-size:13px;text-transform:uppercase;letter-spacing:.03em;">📋 Roteiro rápido — próximos passos</p>
      <ul style="margin:0;padding-left:18px;color:#1e40af;font-size:13px;line-height:1.6;">
        <li style="margin-bottom:8px;"><strong>Perguntou como funciona / quer saber mais:</strong> convide pra fazer a simulação no site (já dá uma estimativa de economia em R$) ou colete os dados da obra direto por ali; deixe claro que a análise inicial não tem custo.</li>
        <li style="margin-bottom:8px;"><strong>Perguntou quanto custa:</strong> reforce que a análise inicial não tem custo — o honorário é de 12% sobre a economia comprovada, e só é definido depois de confirmada.</li>
        <li style="margin-bottom:8px;"><strong>Não respondeu em 1-2 dias:</strong> mande um segundo contato, convidando de novo pra fazer a simulação no site.</li>
        <li><strong>Disse que vai resolver por conta própria ou vai pensar:</strong> reforce, sem pressionar, que a pendência é corrigida pela Selic mês a mês e que, sem a regularização, não é possível emitir a certidão negativa (CND) necessária para vender, financiar ou dar baixa no imóvel.</li>
      </ul>
    </div>`;
}

async function saveToSupabase(guiaLead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[notify-guia-lead] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas no projeto Vercel.');
    return { ok: false, reason: 'db_not_configured' };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/guia_leads`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: generateId(),
        nome: guiaLead.nome ?? null,
        email: guiaLead.email ?? null,
        whatsapp: guiaLead.whatsapp ?? null,
        material: guiaLead.material || 'guia-caminho-regularizacao',
        created_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[notify-guia-lead] Falha ao gravar no Supabase:', response.status, errorText);
      return { ok: false, reason: 'db_save_failed' };
    }

    return { ok: true };
  } catch (error) {
    console.error('[notify-guia-lead] Erro inesperado ao gravar no Supabase:', error);
    return { ok: false, reason: 'db_exception' };
  }
}

async function sendEmail(guiaLead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[notify-guia-lead] RESEND_API_KEY não configurada no projeto Vercel.');
    return { ok: false, reason: 'email_not_configured' };
  }

  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;
  const nome = escapeHtml(guiaLead.nome || 'Sem nome');
  const leadEmail = escapeHtml(guiaLead.email || 'Sem e-mail');
  const whatsapp = escapeHtml(guiaLead.whatsapp || 'Sem WhatsApp');
  const material = escapeHtml(materialLabel(guiaLead.material));
  const whatsappLink = buildWhatsAppLink(guiaLead);

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Simulador INSS de Obras <onboarding@resend.dev>',
        to: [toEmail],
        reply_to: toEmail,
        subject: `Novo download do guia gratuito: ${guiaLead.nome || 'Visitante do site'}`,
        html: `
          <div style="font-family:sans-serif;font-size:14px;color:#0f1638;max-width:600px;margin:0 auto;">
            <p><strong>${nome}</strong> baixou o guia gratuito "${material}".</p>
            <p>E-mail: ${leadEmail}</p>
            <p>WhatsApp: ${whatsapp}</p>
            <p style="color:#7c8ab0;font-size:12px;">Este é um contato ainda sem simulação completa — considere fazer um follow-up.</p>
            ${
              whatsappLink
                ? `<a href="${whatsappLink}" style="display:inline-block;margin-top:8px;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">Chamar ${nome} no WhatsApp</a>`
                : ''
            }
            ${buildRoteiroHtml()}
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('[notify-guia-lead] Falha ao enviar via Resend:', resendResponse.status, errorText);
      return { ok: false, reason: 'send_failed' };
    }

    return { ok: true };
  } catch (error) {
    console.error('[notify-guia-lead] Erro inesperado ao enviar e-mail:', error);
    return { ok: false, reason: 'exception' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  let guiaLead = req.body;
  if (typeof guiaLead === 'string') {
    try {
      guiaLead = JSON.parse(guiaLead);
    } catch {
      res.status(400).json({ ok: false, reason: 'invalid_body' });
      return;
    }
  }
  if (!guiaLead || typeof guiaLead !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_body' });
    return;
  }

  const [email, db] = await Promise.all([sendEmail(guiaLead), saveToSupabase(guiaLead)]);

  res.status(200).json({ ok: email.ok || db.ok, email, db });
}
