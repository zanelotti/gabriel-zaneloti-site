/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — CADASTRO NO PROGRAMA DE PARCEIROS
 * ============================================================================
 * Chamada pela página /parceiros.html (`parceiroService.ts`) quando um
 * profissional (engenheiro, contador, arquiteto...) se cadastra. Faz duas
 * coisas em paralelo, cada uma independente da outra:
 *   1. Envia um e-mail para o Gabriel avisando do novo parceiro.
 *   2. Grava o parceiro na tabela `parceiros` do Supabase (rodar antes o
 *      arquivo `supabase_parceiros.sql`).
 * Usa as mesmas variáveis de ambiente das outras funções (RESEND_API_KEY,
 * LEAD_NOTIFICATION_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * ============================================================================
 */

const DEFAULT_NOTIFICATION_EMAIL = 'comercial.mfzeng@gmail.com';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function texto(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

/** Limpa e limita os campos que chegam do navegador (nunca confiar no que vem de fora). */
function normalizar(body) {
  return {
    nome: texto(body.nome, 120),
    profissao: texto(body.profissao, 60),
    cidade: texto(body.cidade, 80),
    whatsapp: onlyDigits(body.whatsapp).slice(0, 15),
    email: texto(body.email, 120),
    codigo: texto(body.codigo, 40).toLowerCase().replace(/[^a-z0-9-]/g, ''),
  };
}

function valido(p) {
  return p.nome.length >= 2 && p.codigo.length >= 5 && p.whatsapp.length >= 10 && /.+@.+\..+/.test(p.email);
}

async function saveToSupabase(p) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[notify-parceiro] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas.');
    return { ok: false, reason: 'db_not_configured' };
  }
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/parceiros`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        codigo: p.codigo,
        nome: p.nome,
        profissao: p.profissao || null,
        cidade: p.cidade || null,
        whatsapp: p.whatsapp,
        email: p.email,
        created_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      console.error('[notify-parceiro] Falha ao gravar no Supabase:', response.status, await response.text());
      return { ok: false, reason: 'db_save_failed' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[notify-parceiro] Erro inesperado ao gravar no Supabase:', error);
    return { ok: false, reason: 'db_exception' };
  }
}

async function sendEmail(p) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[notify-parceiro] RESEND_API_KEY não configurada.');
    return { ok: false, reason: 'email_not_configured' };
  }
  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;
  const numero = p.whatsapp.length <= 11 ? `55${p.whatsapp}` : p.whatsapp;
  const textoZap = `Oi ${p.nome.split(' ')[0]}, tudo bem? Aqui é o Gabriel Zaneloti. Vi seu cadastro no programa de parceiros. Vou te mandar o contrato simples de parceria (20% quando o cliente pagar) e tirar qualquer dúvida. Pode ser?`;
  const link = `https://wa.me/${numero}?text=${encodeURIComponent(textoZap)}`;

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simulador INSS de Obras <onboarding@resend.dev>',
        to: [toEmail],
        reply_to: p.email,
        subject: `Novo parceiro: ${p.nome} (${p.profissao || 'profissional'})`,
        html: `
          <div style="font-family:sans-serif;font-size:14px;color:#0f1638;max-width:600px;margin:0 auto;">
            <h2 style="margin:0 0 8px;font-size:18px;">Novo parceiro cadastrado 🤝</h2>
            <p><strong>${escapeHtml(p.nome)}</strong> — ${escapeHtml(p.profissao || 'profissão não informada')}${p.cidade ? ` · ${escapeHtml(p.cidade)}` : ''}</p>
            <p>WhatsApp: ${escapeHtml(p.whatsapp)}<br/>E-mail: ${escapeHtml(p.email)}<br/>Código: <strong>${escapeHtml(p.codigo)}</strong></p>
            <a href="${link}" style="display:inline-block;margin-top:4px;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">Chamar ${escapeHtml(p.nome.split(' ')[0])} no WhatsApp</a>
            <div style="margin:18px 0 0;padding:14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;font-size:13px;line-height:1.6;">
              <strong>Próximos passos</strong><br/>
              1) Mande o contrato simples de parceria (20% sobre o honorário recebido, pago quando o cliente pagar).<br/>
              2) Combine o recebimento: Pix com recibo/nota fiscal.<br/>
              3) Quando chegar uma simulação por esse código, o e-mail da simulação traz "Indicação de parceiro: ${escapeHtml(p.codigo)}".
            </div>
          </div>`,
      }),
    });
    if (!resposta.ok) {
      console.error('[notify-parceiro] Falha ao enviar via Resend:', resposta.status, await resposta.text());
      return { ok: false, reason: 'send_failed' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[notify-parceiro] Erro inesperado ao enviar e-mail:', error);
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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ ok: false, reason: 'invalid_body' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_body' });
    return;
  }

  // Campo-isca: robôs preenchem, pessoas não. Finge sucesso e descarta.
  if (body.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const parceiro = normalizar(body);
  if (!valido(parceiro)) {
    res.status(400).json({ ok: false, reason: 'invalid_fields' });
    return;
  }

  const [email, db] = await Promise.all([sendEmail(parceiro), saveToSupabase(parceiro)]);
  res.status(200).json({ ok: email.ok || db.ok, email, db });
}
