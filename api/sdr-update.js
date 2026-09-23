/**
 * /api/sdr-update — grava o resultado de uma rodada de conversa do SDR
 * automatizado: acrescenta uma mensagem ao histórico e/ou muda o estado da
 * conversa (ver SDR_PLAYBOOK.md para os estados possíveis).
 *
 * Endpoint privado, chamado só pelo scheduled task do SDR — protegido pelo
 * mesmo token de /api/sdr-pending.
 *
 * Body (JSON):
 *   {
 *     "id": "abc123",                     // obrigatório — id do lead
 *     "entry": { "de": "bot", "texto": "..." },   // opcional — mensagem a registrar no histórico
 *     "novo_estado": "aguardando_lead",   // opcional — novo sdr_estado
 *     "proximo_contato": "2026-10-01",    // opcional — data (YYYY-MM-DD) ou null para limpar
 *     "sdr_ativo": false,                 // opcional — ex: para pausar o SDR nesse lead
 *     "lead_nome": "...",                 // opcional — só usado no e-mail de alerta abaixo
 *     "lead_whatsapp": "..."              // opcional — idem
 *   }
 *
 * Quando `novo_estado` vira "aguardando_gabriel", dispara um e-mail de
 * alerta pro Gabriel avisando que um lead está pronto para receber o valor
 * dos honorários (reaproveita RESEND_API_KEY / LEAD_NOTIFICATION_EMAIL, já
 * configuradas para /api/notify-lead.js).
 *
 * Variáveis de ambiente exigidas (Vercel):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SDR_API_TOKEN
 *   - RESEND_API_KEY            (opcional — só para o e-mail de alerta)
 *   - LEAD_NOTIFICATION_EMAIL   (opcional — idem)
 */

const ESTADOS_VALIDOS = [
  'novo',
  'aguardando_lead',
  'follow_up_agendado',
  'aguardando_gabriel',
  'retomado_pos_honorarios',
  'fechado',
  'perdido',
  'pausado',
];

const DEFAULT_NOTIFICATION_EMAIL = 'comercial.mfzeng@gmail.com';

async function appendHistorico(url, key, id, entry) {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/sdr_append_historico`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_id: id,
      p_entry: { ...entry, em: new Date().toISOString() },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao gravar histórico: ${response.status} ${errorText}`);
  }
}

async function patchLead(url, key, id, patch) {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao atualizar o lead: ${response.status} ${errorText}`);
  }
}

/** Alerta por e-mail: nunca deve derrubar a resposta principal se falhar. */
async function alertarGabriel(nome, whatsapp) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SDR INSS de Obras <onboarding@resend.dev>',
        to: [toEmail],
        reply_to: toEmail,
        subject: `[SDR] Lead pronto para você informar os honorários — ${nome || 'sem nome'}`,
        html: `
          <p>O SDR automatizado conduziu a conversa até o ponto de falar de valores e parou, como combinado.</p>
          <p><strong>Lead:</strong> ${nome || 'sem nome'}<br/>
          <strong>WhatsApp:</strong> ${whatsapp || '—'}</p>
          <p>Fale com o cliente e informe os honorários. Depois, marque no CRM (painel do lead → SDR)
          o botão "Já informei os honorários — retomar SDR" para o robô voltar a conduzir o fechamento.</p>
        `,
      }),
    });
  } catch (error) {
    console.error('[sdr-update] Falha ao enviar alerta por e-mail (não bloqueante):', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  const token = req.headers['x-sdr-token'];
  if (!token || token !== process.env.SDR_API_TOKEN) {
    res.status(401).json({ ok: false, reason: 'unauthorized' });
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
  if (!body || typeof body !== 'object' || !body.id) {
    res.status(400).json({ ok: false, reason: 'invalid_body' });
    return;
  }

  if (body.novo_estado && !ESTADOS_VALIDOS.includes(body.novo_estado)) {
    res.status(400).json({ ok: false, reason: 'estado_invalido' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ ok: false, reason: 'db_not_configured' });
    return;
  }

  try {
    const tasks = [];

    if (body.entry && typeof body.entry === 'object' && body.entry.texto) {
      tasks.push(appendHistorico(url, key, body.id, body.entry));
    }

    const patch = {};
    if (body.novo_estado) patch.sdr_estado = body.novo_estado;
    if (Object.prototype.hasOwnProperty.call(body, 'proximo_contato')) {
      patch.sdr_proximo_contato = body.proximo_contato || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'sdr_ativo')) {
      patch.sdr_ativo = Boolean(body.sdr_ativo);
    }
    if (Object.keys(patch).length > 0) {
      tasks.push(patchLead(url, key, body.id, patch));
    }

    await Promise.all(tasks);

    if (body.novo_estado === 'aguardando_gabriel') {
      // Não aguarda nem bloqueia a resposta por causa do e-mail.
      alertarGabriel(body.lead_nome, body.lead_whatsapp);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[sdr-update] Erro inesperado:', error);
    res.status(500).json({ ok: false, reason: 'exception', detail: String(error) });
  }
}
