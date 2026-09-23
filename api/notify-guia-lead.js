/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — CAPTURA DO "GUIA GRATUITO" (lead magnet)
 * ============================================================================
 * Chamada pelo frontend (`guiaLeadService.ts`) quando alguém baixa o guia
 * gratuito em PDF pela seção "5 erros que fazem construtoras pagarem mais
 * INSS de obra". Faz duas coisas, em paralelo, cada uma independente da
 * outra:
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
  'guia-5-erros': '5 erros que fazem pessoas físicas pagarem mais INSS de obra',
  'guia-caminho-regularizacao': 'O caminho da regularização da sua obra',
};

function materialLabel(material) {
  return MATERIAIS[material] || MATERIAIS['guia-5-erros'];
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
        whatsapp: guiaLead.whatsapp ?? null,
        material: guiaLead.material || 'guia-5-erros',
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
  const whatsapp = escapeHtml(guiaLead.whatsapp || 'Sem WhatsApp');
  const material = escapeHtml(materialLabel(guiaLead.material));

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
          <div style="font-family:sans-serif;font-size:14px;color:#0f1638;">
            <p><strong>${nome}</strong> baixou o guia gratuito "${material}".</p>
            <p>WhatsApp: ${whatsapp}</p>
            <p style="color:#7c8ab0;font-size:12px;">Este é um contato ainda sem simulação completa — considere fazer um follow-up.</p>
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
