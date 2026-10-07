/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — AGENDAR A CONSULTORIA GRATUITA
 * ============================================================================
 * POST /api/agendar
 *
 * Quando alguém escolhe um horário no site:
 *   1. valida os dados e confere se o horário é um dos que oferecemos;
 *   2. confere no Google Agenda se o horário continua livre;
 *   3. grava o agendamento no Supabase (tabela `agendamentos`) — isso também
 *      "reserva" o horário, porque existe um índice único em `inicio`;
 *   4. cria o evento no Google Agenda do Gabriel (é ele que dispara a
 *      notificação no celular, conforme as notificações padrão da agenda);
 *   5. envia um e-mail de aviso pro Gabriel (e, se AGENDA_EMAIL_FROM estiver
 *      configurado, um e-mail de confirmação pra pessoa).
 *
 * Cada integração é opcional: se alguma falhar ou não estiver configurada,
 * as outras continuam e a pessoa NUNCA é impedida de agendar por causa disso
 * (o aviso por e-mail pro Gabriel sempre leva todos os dados do contato).
 *
 * Variáveis: RESEND_API_KEY, LEAD_NOTIFICATION_EMAIL, SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY (as mesmas das outras funções), mais as do Google
 * Agenda (ver server/google-calendar.js) e, opcionais:
 *   AGENDA_VIDEO_LINK   link fixo de reunião (Meet/Zoom) mostrado à pessoa
 *   AGENDA_EMAIL_FROM   remetente de um domínio verificado no Resend, para
 *                       mandar a confirmação à pessoa (ex: contato@seudominio.com.br)
 * ============================================================================
 */

import { randomUUID } from 'node:crypto';
import {
  deleteBooking,
  getConfig,
  horizon,
  insertBooking,
  isOfferedSlot,
  listActiveBookings,
  overlaps,
  patchBooking,
} from '../server/agenda-core.js';
import { createEvent, getBusy, isConfigured as googleConfigured } from '../server/google-calendar.js';

const DEFAULT_NOTIFICATION_EMAIL = 'comercial.mfzeng@gmail.com';
const TIME_ZONE = 'America/Sao_Paulo';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function clip(value, max) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function isValidWhatsApp(digits) {
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatDateTime(ms) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatShort(ms) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}

function whatsappLink(digits, texto) {
  const numero = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function origemTexto(b) {
  const partes = [];
  if (b.gclid || b.gbraid || b.wbraid) partes.push('Google Ads (clique rastreado)');
  if (b.utm_source) partes.push(`origem: ${b.utm_source}`);
  if (b.utm_medium) partes.push(`mídia: ${b.utm_medium}`);
  if (b.utm_campaign) partes.push(`campanha: ${b.utm_campaign}`);
  return partes.length ? partes.join(' · ') : 'Acesso direto / orgânico';
}

async function sendEmails({ booking, startMs, eventLink, calendarOk, videoLink }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[agendar] RESEND_API_KEY não configurada no projeto Vercel.');
    return { ok: false, reason: 'email_not_configured' };
  }

  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;
  const primeiroNome = booking.nome.split(' ')[0];
  const quando = formatDateTime(startMs);

  const textoWhats = `Oi ${primeiroNome}, tudo bem? Aqui é o Gabriel. Passando pra confirmar a nossa consultoria gratuita: ${quando} (horário de Brasília). Vamos conversar uns 10 minutos, eu tiro suas dúvidas e apresento uma proposta pensada para o seu caso. Até lá!`;
  const linkWhats = whatsappLink(booking.whatsapp, textoWhats);

  const avisoAgenda = calendarOk
    ? `<p style="margin:12px 0 0;font-size:13px;color:#166534;">✅ Evento criado no seu Google Agenda${
        eventLink ? ` — <a href="${escapeHtml(eventLink)}">abrir evento</a>` : ''
      }.</p>`
    : `<p style="margin:12px 0 0;font-size:13px;color:#b45309;"><strong>⚠️ O evento NÃO foi criado no Google Agenda</strong> (integração não configurada ou fora do ar). Adicione este horário manualmente na sua agenda.</p>`;

  const gabrielHtml = `
    <div style="font-family:sans-serif;font-size:14px;color:#0f1638;max-width:600px;margin:0 auto;">
      <p style="font-size:16px;margin:0 0 12px;"><strong>${escapeHtml(booking.nome)}</strong> agendou a consultoria gratuita.</p>
      <p style="margin:0 0 4px;font-size:18px;"><strong>📅 ${escapeHtml(quando)}</strong> <span style="color:#7c8ab0;font-size:12px;">(horário de Brasília)</span></p>
      <p style="margin:12px 0 0;">WhatsApp: ${escapeHtml(booking.whatsapp)}<br/>E-mail: ${escapeHtml(booking.email)}</p>
      ${booking.observacoes ? `<p style="margin:12px 0 0;padding:10px 12px;background:#f1f5f9;border-radius:8px;"><strong>Sobre a obra:</strong><br/>${escapeHtml(booking.observacoes)}</p>` : ''}
      <p style="margin:12px 0 0;color:#7c8ab0;font-size:12px;">${escapeHtml(origemTexto(booking))}</p>
      ${avisoAgenda}
      <a href="${linkWhats}" style="display:inline-block;margin-top:14px;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">Confirmar com ${escapeHtml(primeiroNome)} no WhatsApp</a>
      ${videoLink ? `<p style="margin:12px 0 0;font-size:12px;color:#7c8ab0;">Link da reunião mostrado à pessoa: ${escapeHtml(videoLink)}</p>` : ''}
    </div>`;

  const jobs = [
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Simulador INSS de Obras <onboarding@resend.dev>',
        to: [toEmail],
        reply_to: booking.email,
        subject: `Consultoria agendada: ${booking.nome} — ${formatShort(startMs)}`,
        html: gabrielHtml,
      }),
    }),
  ];

  const fromLead = process.env.AGENDA_EMAIL_FROM;
  if (fromLead) {
    const leadHtml = `
      <div style="font-family:sans-serif;font-size:15px;color:#0f1638;max-width:560px;margin:0 auto;">
        <p>Olá, ${escapeHtml(primeiroNome)}! Sua consultoria gratuita está confirmada.</p>
        <p style="font-size:18px;margin:12px 0;"><strong>📅 ${escapeHtml(quando)}</strong><br/><span style="font-size:12px;color:#7c8ab0;">horário de Brasília</span></p>
        <p>Vamos conversar por cerca de 10 minutos: eu esclareço as suas dúvidas e apresento uma proposta personalizada para o seu caso.</p>
        <p>${
          videoLink
            ? `Link da reunião: <a href="${escapeHtml(videoLink)}">${escapeHtml(videoLink)}</a>`
            : 'No horário combinado, eu te chamo pelo WhatsApp.'
        }</p>
        <p style="margin-top:20px;">Precisa remarcar? É só responder este e-mail ou me chamar no WhatsApp.</p>
        <p>Gabriel Zaneloti<br/><span style="color:#7c8ab0;font-size:13px;">Planejamento Tributário | INSS de Obras</span></p>
      </div>`;
    jobs.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Gabriel Zaneloti <${fromLead}>`,
          to: [booking.email],
          reply_to: toEmail,
          subject: `Consultoria confirmada — ${formatShort(startMs)}`,
          html: leadHtml,
        }),
      })
    );
  }

  try {
    const results = await Promise.all(jobs);
    const failed = [];
    for (const r of results) {
      if (!r.ok) failed.push(`${r.status} ${(await r.text()).slice(0, 200)}`);
    }
    if (failed.length) {
      console.error('[agendar] Falha ao enviar e-mail via Resend:', failed.join(' | '));
      return { ok: failed.length < results.length, reason: 'send_failed' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[agendar] Erro inesperado ao enviar e-mail:', error);
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

  // Campo-isca (escondido no formulário): robô preenche, pessoa não. Responde
  // "sucesso" sem fazer nada pra não dar pista ao robô.
  if (body.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const nome = clip(body.nome, 120);
  const email = (clip(body.email, 160) || '').toLowerCase();
  const whatsapp = onlyDigits(body.whatsapp);
  const startMs = Date.parse(body.inicio);

  if (!nome || nome.length < 2) {
    res.status(400).json({ ok: false, reason: 'invalid_nome' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, reason: 'invalid_email' });
    return;
  }
  if (!isValidWhatsApp(whatsapp)) {
    res.status(400).json({ ok: false, reason: 'invalid_whatsapp' });
    return;
  }

  const config = getConfig();
  const nowMs = Date.now();
  if (!Number.isFinite(startMs) || !isOfferedSlot(startMs, nowMs, config)) {
    res.status(400).json({ ok: false, reason: 'invalid_slot' });
    return;
  }
  const endMs = startMs + config.meetingMinutes * 60_000;

  // Já tem uma consultoria futura marcada com este WhatsApp? Evita duplicar.
  const { fromMs, toMs } = horizon(nowMs, config);
  try {
    const existing = (await listActiveBookings(fromMs, toMs)).find((b) => b.whatsapp === whatsapp);
    if (existing) {
      res.status(409).json({ ok: false, reason: 'ja_agendado', inicio: new Date(existing.startMs).toISOString() });
      return;
    }
  } catch (error) {
    console.error('[agendar] Não foi possível checar duplicidade:', error.message);
  }

  // O horário ainda está livre no Google Agenda?
  if (googleConfigured()) {
    try {
      const busy = await getBusy(startMs - 60_000, endMs + 60_000);
      if (busy.some((b) => overlaps(startMs, endMs, b.start, b.end))) {
        res.status(409).json({ ok: false, reason: 'slot_taken' });
        return;
      }
    } catch (error) {
      console.error('[agendar] Não foi possível checar o Google Agenda:', error.message);
    }
  }

  const id = randomUUID();
  const booking = {
    id,
    nome,
    email,
    whatsapp,
    observacoes: clip(body.observacoes, 300),
    utm_source: clip(body.utmSource, 200),
    utm_medium: clip(body.utmMedium, 200),
    utm_campaign: clip(body.utmCampaign, 200),
    utm_term: clip(body.utmTerm, 200),
    utm_content: clip(body.utmContent, 200),
    gclid: clip(body.gclid, 300),
    gbraid: clip(body.gbraid, 300),
    wbraid: clip(body.wbraid, 300),
    landing_page: clip(body.landingPage, 500),
    referrer: clip(body.referrer, 500),
    visitor_id: clip(body.visitorId, 100),
  };

  // Reserva o horário (índice único). Se outra pessoa pegou no meio-tempo, avisa.
  const db = await insertBooking({
    ...booking,
    inicio: new Date(startMs).toISOString(),
    fim: new Date(endMs).toISOString(),
    status: 'agendado',
    created_at: new Date(nowMs).toISOString(),
  });
  if (!db.ok && db.reason === 'slot_taken') {
    res.status(409).json({ ok: false, reason: 'slot_taken' });
    return;
  }

  // Evento no Google Agenda (é ele que notifica o celular do Gabriel).
  const videoLink = process.env.AGENDA_VIDEO_LINK || null;
  let calendar = { ok: false, reason: 'calendar_not_configured' };
  let eventLink = null;
  if (googleConfigured()) {
    try {
      const descricao = [
        `Contato: ${nome}`,
        `WhatsApp: ${whatsapp}  →  https://wa.me/55${whatsapp}`,
        `E-mail: ${email}`,
        booking.observacoes ? `Sobre a obra: ${booking.observacoes}` : null,
        `Origem: ${origemTexto(booking)}`,
        videoLink ? `Reunião: ${videoLink}` : 'Reunião: chamar pelo WhatsApp no horário.',
        '',
        'Consultoria gratuita (~10 min): esclarecer dúvidas e apresentar proposta personalizada.',
      ]
        .filter((line) => line !== null)
        .join('\n');

      const event = await createEvent({
        summary: `Consultoria gratuita — ${nome}`,
        description: descricao,
        startMs,
        endMs,
        agendamentoId: id,
      });
      eventLink = event.htmlLink || null;
      calendar = { ok: true };
      if (db.ok) await patchBooking(id, { google_event_id: event.id, google_event_link: eventLink });
    } catch (error) {
      console.error('[agendar] Falha ao criar evento no Google Agenda:', error.message);
      calendar = { ok: false, reason: 'calendar_failed' };
    }
  }

  // Se não conseguimos gravar NEM no banco NEM no Google, o e-mail pro
  // Gabriel é o único registro — ele sempre sai (e leva todos os dados).
  const email_ = await sendEmails({ booking, startMs, eventLink, calendarOk: calendar.ok, videoLink });

  if (!db.ok && !calendar.ok && !email_.ok) {
    // Nada registrou o pedido. Libera o horário (se algo chegou a ser gravado) e avisa a pessoa.
    await deleteBooking(id);
    res.status(502).json({ ok: false, reason: 'unavailable' });
    return;
  }

  res.status(200).json({
    ok: true,
    id,
    inicio: new Date(startMs).toISOString(),
    fim: new Date(endMs).toISOString(),
    videoLink,
    db,
    calendar,
    email: email_,
  });
}
