/**
 * ============================================================================
 *  AGENDA — regras de horário e acesso ao Supabase (compartilhado por
 *  /api/agenda-horarios.js e /api/agendar.js)
 * ============================================================================
 * Variáveis de ambiente opcionais (todas têm um padrão):
 *   AGENDA_WORKING_DAYS      dias de atendimento, 0=dom ... 6=sáb   (padrão "1,2,3,4,5")
 *   AGENDA_WORKING_HOURS     janelas de atendimento                  (padrão "09:00-12:00,14:00-18:00")
 *   AGENDA_SLOT_MINUTES      espaçamento entre horários oferecidos   (padrão 15)
 *   AGENDA_MEETING_MINUTES   duração da consultoria                  (padrão 10)
 *   AGENDA_DAYS_AHEAD        quantos dias à frente oferecer          (padrão 14)
 *   AGENDA_MIN_NOTICE_HOURS  antecedência mínima                     (padrão 2)
 *   AGENDA_UTC_OFFSET_MINUTES fuso (Brasília = -180, sem horário de verão desde 2019)
 * ============================================================================
 */

function intEnv(name, fallback, { min = 1, max = 100000 } = {}) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return value;
}

export function getConfig() {
  const days = (process.env.AGENDA_WORKING_DAYS || '1,2,3,4,5')
    .split(',')
    .map((d) => Number.parseInt(d.trim(), 10))
    .filter((d) => d >= 0 && d <= 6);

  const windows = (process.env.AGENDA_WORKING_HOURS || '09:00-12:00,14:00-18:00')
    .split(',')
    .map((part) => /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(part))
    .filter(Boolean)
    .map((m) => ({ start: Number(m[1]) * 60 + Number(m[2]), end: Number(m[3]) * 60 + Number(m[4]) }))
    .filter((w) => w.end > w.start);

  return {
    workingDays: days.length ? days : [1, 2, 3, 4, 5],
    windows: windows.length ? windows : [{ start: 9 * 60, end: 12 * 60 }, { start: 14 * 60, end: 18 * 60 }],
    slotMinutes: intEnv('AGENDA_SLOT_MINUTES', 15, { min: 5, max: 240 }),
    meetingMinutes: intEnv('AGENDA_MEETING_MINUTES', 10, { min: 5, max: 240 }),
    daysAhead: intEnv('AGENDA_DAYS_AHEAD', 14, { min: 1, max: 60 }),
    minNoticeMs: intEnv('AGENDA_MIN_NOTICE_HOURS', 2, { min: 0, max: 168 }) * 3600_000,
    offsetMinutes: Number.isFinite(Number.parseInt(process.env.AGENDA_UTC_OFFSET_MINUTES ?? '', 10))
      ? Number.parseInt(process.env.AGENDA_UTC_OFFSET_MINUTES, 10)
      : -180,
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Gera todos os horários possíveis (antes de descontar ocupados).
 * Retorna [{ data: 'YYYY-MM-DD', slots: [{ startMs, endMs }] }].
 */
export function generateSlots(nowMs = Date.now(), config = getConfig()) {
  const local = new Date(nowMs + config.offsetMinutes * 60_000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const meetingMs = config.meetingMinutes * 60_000;
  const result = [];

  for (let i = 0; i <= config.daysAhead; i += 1) {
    const dayUtc = Date.UTC(y, m, d + i);
    const date = new Date(dayUtc);
    if (!config.workingDays.includes(date.getUTCDay())) continue;

    const slots = [];
    for (const window of config.windows) {
      for (let minute = window.start; minute + config.meetingMinutes <= window.end; minute += config.slotMinutes) {
        const startMs = dayUtc + minute * 60_000 - config.offsetMinutes * 60_000;
        if (startMs < nowMs + config.minNoticeMs) continue;
        slots.push({ startMs, endMs: startMs + meetingMs });
      }
    }

    if (slots.length) {
      result.push({ data: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`, slots });
    }
  }

  return result;
}

/** O horário pedido é exatamente um dos horários que oferecemos? */
export function isOfferedSlot(startMs, nowMs = Date.now(), config = getConfig()) {
  return generateSlots(nowMs, config).some((day) => day.slots.some((s) => s.startMs === startMs));
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/** Janela total (ms) que cobre todos os horários oferecidos — usada pra consultar ocupados de uma vez. */
export function horizon(nowMs = Date.now(), config = getConfig()) {
  return { fromMs: nowMs, toMs: nowMs + (config.daysAhead + 2) * 86_400_000 };
}

// ---------------------------------------------------------------------------
// Supabase (REST, chave service_role) — tabela `agendamentos`
// ---------------------------------------------------------------------------

function supabaseBase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

export function isSupabaseConfigured() {
  return Boolean(supabaseBase());
}

function headers(key, extra = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extra };
}

/** Agendamentos ativos no período. Retorna [{ inicio, fim, whatsapp }] ou lança erro. */
export async function listActiveBookings(fromMs, toMs) {
  const cfg = supabaseBase();
  if (!cfg) return [];
  const query =
    `select=inicio,fim,whatsapp&status=eq.agendado` +
    `&inicio=gte.${encodeURIComponent(new Date(fromMs).toISOString())}` +
    `&inicio=lt.${encodeURIComponent(new Date(toMs).toISOString())}`;
  const response = await fetch(`${cfg.url}/rest/v1/agendamentos?${query}`, { headers: headers(cfg.key) });
  if (!response.ok) throw new Error(`listar agendamentos falhou (${response.status}): ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json();
  return rows.map((r) => ({ startMs: Date.parse(r.inicio), endMs: Date.parse(r.fim), whatsapp: r.whatsapp }));
}

/**
 * Grava o agendamento (isso "reserva" o horário: existe um índice único em
 * `inicio` para status 'agendado'). Retorna { ok:true } | { ok:false, reason }.
 */
export async function insertBooking(row) {
  const cfg = supabaseBase();
  if (!cfg) return { ok: false, reason: 'db_not_configured' };
  try {
    const response = await fetch(`${cfg.url}/rest/v1/agendamentos`, {
      method: 'POST',
      headers: headers(cfg.key, { Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    });
    if (response.status === 409) return { ok: false, reason: 'slot_taken' };
    if (!response.ok) {
      console.error('[agenda] Falha ao gravar agendamento:', response.status, (await response.text()).slice(0, 300));
      return { ok: false, reason: 'db_save_failed' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[agenda] Erro ao gravar agendamento:', error);
    return { ok: false, reason: 'db_exception' };
  }
}

export async function patchBooking(id, fields) {
  const cfg = supabaseBase();
  if (!cfg) return { ok: false };
  try {
    const response = await fetch(`${cfg.url}/rest/v1/agendamentos?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers(cfg.key, { Prefer: 'return=minimal' }),
      body: JSON.stringify(fields),
    });
    if (!response.ok) {
      console.error('[agenda] Falha ao atualizar agendamento:', response.status, (await response.text()).slice(0, 300));
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error('[agenda] Erro ao atualizar agendamento:', error);
    return { ok: false };
  }
}

export async function deleteBooking(id) {
  const cfg = supabaseBase();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url}/rest/v1/agendamentos?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(cfg.key),
    });
  } catch (error) {
    console.error('[agenda] Erro ao remover agendamento:', error);
  }
}
