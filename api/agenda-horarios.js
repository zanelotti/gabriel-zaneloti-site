/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — HORÁRIOS LIVRES PARA A CONSULTORIA GRATUITA
 * ============================================================================
 * GET /api/agenda-horarios
 *
 * Devolve os próximos dias/horários em que dá pra agendar, já descontando:
 *   - o que está ocupado no Google Agenda do Gabriel (se configurado);
 *   - o que já foi reservado por outras pessoas pelo site (Supabase).
 *
 * Se o Google Agenda ou o Supabase falharem, o site continua oferecendo os
 * horários (marcando `degradado: true`) — a checagem final acontece em
 * /api/agendar.js, então nunca deixamos de captar o contato por causa disso.
 * ============================================================================
 */

import { getConfig, generateSlots, horizon, listActiveBookings, overlaps } from '../server/agenda-core.js';
import { getBusy, isConfigured as googleConfigured } from '../server/google-calendar.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  const config = getConfig();
  const nowMs = Date.now();
  const days = generateSlots(nowMs, config);
  const { fromMs, toMs } = horizon(nowMs, config);

  let degradado = false;
  const busy = [];

  if (googleConfigured()) {
    try {
      busy.push(...(await getBusy(fromMs, toMs)));
    } catch (error) {
      degradado = true;
      console.error('[agenda-horarios] Google Agenda indisponível:', error.message);
    }
  }

  try {
    const bookings = await listActiveBookings(fromMs, toMs);
    busy.push(...bookings.map((b) => ({ start: b.startMs, end: b.endMs })));
  } catch (error) {
    degradado = true;
    console.error('[agenda-horarios] Supabase indisponível:', error.message);
  }

  const dias = days
    .map((day) => ({
      data: day.data,
      horarios: day.slots
        .filter((slot) => !busy.some((b) => overlaps(slot.startMs, slot.endMs, b.start, b.end)))
        .map((slot) => ({
          inicio: new Date(slot.startMs).toISOString(),
          fim: new Date(slot.endMs).toISOString(),
        })),
    }))
    .filter((day) => day.horarios.length > 0);

  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=15');
  res.status(200).json({
    ok: true,
    fusoHorario: 'America/Sao_Paulo',
    duracaoMinutos: config.meetingMinutes,
    degradado,
    dias,
  });
}
