/**
 * ============================================================================
 *  GOOGLE AGENDA (conta de serviço) — usado pelas funções de agendamento
 * ============================================================================
 * Fala direto com a API REST do Google Calendar, sem nenhuma dependência nova:
 * assina o JWT (RS256) da conta de serviço com `node:crypto` e troca por um
 * token de acesso. Conta de serviço não expira como o login OAuth de teste
 * (que cai a cada 7 dias) — por isso é a opção mais estável pra rodar sozinha.
 *
 * Variáveis de ambiente (Vercel):
 *   GOOGLE_SERVICE_ACCOUNT_JSON   conteúdo inteiro do arquivo .json da chave
 *                                 (ou o mesmo conteúdo em base64)
 *   -- ou, alternativamente --
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  client_email do JSON
 *   GOOGLE_PRIVATE_KEY            private_key do JSON (pode vir com "\n" literais)
 *   GOOGLE_CALENDAR_ID            e-mail da agenda do Gabriel (ou ID da agenda)
 *
 * A agenda do Gabriel precisa ser compartilhada com o e-mail da conta de
 * serviço, com a permissão "Fazer alterações em eventos".
 *
 * Fica fora da pasta /api de propósito: a Vercel conta cada arquivo de /api
 * como uma função serverless, e este aqui é só biblioteca.
 * ============================================================================
 */

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
].join(' ');

let cachedToken = null; // { value, expiresAt }

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Lê as credenciais das variáveis de ambiente. Retorna null se não houver. */
export function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    try {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const json = JSON.parse(text);
      if (json.client_email && json.private_key) {
        return { email: json.client_email, privateKey: String(json.private_key).replace(/\\n/g, '\n') };
      }
    } catch (error) {
      console.error('[google-calendar] GOOGLE_SERVICE_ACCOUNT_JSON inválido:', error.message);
      return null;
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    return { email, privateKey: key.replace(/\\n/g, '\n') };
  }
  return null;
}

export function getCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || null;
}

/** true quando dá pra falar com o Google Agenda (credenciais + ID da agenda). */
export function isConfigured() {
  return Boolean(getCredentials() && getCalendarId());
}

/** Gera (ou reaproveita) o token de acesso da conta de serviço. */
export async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const credentials = getCredentials();
  if (!credentials) throw new Error('credenciais do Google não configuradas');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: credentials.email,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.privateKey).toString('base64url');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`token do Google recusado (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

/**
 * Períodos ocupados na agenda entre `fromMs` e `toMs`.
 * Retorna [{ start: ms, end: ms }]. Lança erro se o Google recusar.
 */
export async function getBusy(fromMs, toMs) {
  const calendarId = getCalendarId();
  const token = await getAccessToken();

  const response = await fetch(`${CALENDAR_API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: new Date(fromMs).toISOString(),
      timeMax: new Date(toMs).toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!response.ok) {
    throw new Error(`freeBusy falhou (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  const calendar = data.calendars?.[calendarId] ?? Object.values(data.calendars ?? {})[0];
  if (!calendar) throw new Error('freeBusy não retornou a agenda');
  if (calendar.errors?.length) {
    throw new Error(`freeBusy com erro na agenda: ${calendar.errors.map((e) => e.reason).join(', ')}`);
  }

  return (calendar.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

/**
 * Cria o evento na agenda do Gabriel. As notificações do celular seguem as
 * notificações padrão que ele configurou na própria agenda (useDefault).
 * Retorna { id, htmlLink }.
 */
export async function createEvent({ summary, description, startMs, endMs, agendamentoId }) {
  const calendarId = getCalendarId();
  const token = await getAccessToken();

  const response = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: new Date(startMs).toISOString(), timeZone: 'America/Sao_Paulo' },
      end: { dateTime: new Date(endMs).toISOString(), timeZone: 'America/Sao_Paulo' },
      reminders: { useDefault: true },
      extendedProperties: { private: { agendamentoId: String(agendamentoId) } },
    }),
  });

  if (!response.ok) {
    throw new Error(`criar evento falhou (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }

  const event = await response.json();
  return { id: event.id, htmlLink: event.htmlLink };
}
