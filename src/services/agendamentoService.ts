/**
 * ============================================================================
 *  AGENDAMENTO DA CONSULTORIA GRATUITA (lado do navegador)
 * ============================================================================
 * Conversa com as funções serverless `/api/agenda-horarios` (lista os horários
 * livres) e `/api/agendar` (grava o agendamento e cria o evento no Google
 * Agenda do Gabriel). Também monta os links "Adicionar ao Google Agenda" e o
 * arquivo .ics que a pessoa recebe na tela de confirmação.
 * ============================================================================
 */

import { getAttribution } from './attribution';

export const FUSO_HORARIO = 'America/Sao_Paulo';

export interface HorarioLivre {
  inicio: string;
  fim: string;
}

export interface DiaLivre {
  /** yyyy-mm-dd (data em Brasília). */
  data: string;
  horarios: HorarioLivre[];
}

export interface HorariosResponse {
  duracaoMinutos: number;
  dias: DiaLivre[];
}

export interface AgendarInput {
  nome: string;
  email: string;
  whatsapp: string;
  observacoes: string;
  inicio: string;
  /** Campo-isca anti-robô: deve ir sempre vazio. */
  website: string;
}

export interface AgendamentoConfirmado {
  inicio: string;
  fim: string;
  videoLink: string | null;
}

export type AgendarErro = 'slot_taken' | 'ja_agendado' | 'invalid' | 'network' | 'unavailable';

export class AgendarError extends Error {
  constructor(public readonly reason: AgendarErro, public readonly inicioExistente?: string) {
    super(reason);
  }
}

export async function fetchHorarios(): Promise<HorariosResponse> {
  const response = await fetch('/api/agenda-horarios');
  if (!response.ok) throw new Error(`horarios_${response.status}`);
  const data = (await response.json()) as { ok: boolean; duracaoMinutos: number; dias: DiaLivre[] };
  if (!data.ok || !Array.isArray(data.dias)) throw new Error('horarios_invalidos');
  return { duracaoMinutos: data.duracaoMinutos, dias: data.dias };
}

export async function agendarConsultoria(input: AgendarInput): Promise<AgendamentoConfirmado> {
  let response: Response;
  try {
    response = await fetch('/api/agendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        ...getAttribution(),
        visitorId: readVisitorId(),
      }),
    });
  } catch {
    throw new AgendarError('network');
  }

  let data: { ok?: boolean; reason?: string; inicio?: string; fim?: string; videoLink?: string | null } = {};
  try {
    data = await response.json();
  } catch {
    // resposta sem JSON — trata abaixo pelo status
  }

  if (response.ok && data.ok && data.inicio && data.fim) {
    return { inicio: data.inicio, fim: data.fim, videoLink: data.videoLink ?? null };
  }

  if (data.reason === 'slot_taken') throw new AgendarError('slot_taken');
  if (data.reason === 'ja_agendado') throw new AgendarError('ja_agendado', data.inicio);
  if (response.status >= 400 && response.status < 500) throw new AgendarError('invalid');
  throw new AgendarError('unavailable');
}

function readVisitorId(): string | undefined {
  try {
    return window.localStorage.getItem('gz_visitor_id') ?? undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Formatação e links de calendário
// ---------------------------------------------------------------------------

/** "quinta-feira, 08/10/2026, 10:00" */
export function formatarDataHora(isoDateTime: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDateTime));
}

export function formatarHora(isoDateTime: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDateTime));
}

/** Rótulos de um dia (yyyy-mm-dd em Brasília): dia da semana curto + dia/mês. */
export function rotuloDia(data: string): { semana: string; diaMes: string } {
  const date = new Date(`${data}T12:00:00-03:00`);
  const semana = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, weekday: 'short' })
    .format(date)
    .replace('.', '');
  const diaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit' }).format(date);
  return { semana, diaMes };
}

function paraFormatoCalendario(isoDateTime: string): string {
  return new Date(isoDateTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const TITULO_EVENTO = 'Consultoria gratuita com Gabriel Zaneloti';

function detalhesEvento(videoLink: string | null): string {
  return [
    'Conversa de cerca de 10 minutos: esclareço suas dúvidas e apresento uma proposta personalizada para o seu caso.',
    videoLink ? `Link da reunião: ${videoLink}` : 'No horário combinado, eu te chamo pelo WhatsApp.',
  ].join('\n');
}

/** Link "Adicionar ao Google Agenda" (a pessoa salva o compromisso na agenda dela). */
export function linkGoogleAgenda(ag: AgendamentoConfirmado): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITULO_EVENTO,
    dates: `${paraFormatoCalendario(ag.inicio)}/${paraFormatoCalendario(ag.fim)}`,
    details: detalhesEvento(ag.videoLink),
    ctz: FUSO_HORARIO,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Conteúdo de um arquivo .ics (Apple Calendar, Outlook etc.). */
export function montarIcs(ag: AgendamentoConfirmado): string {
  const escapar = (texto: string) => texto.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gabriel Zaneloti//Consultoria//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${paraFormatoCalendario(ag.inicio)}@gabrielzaneloti`,
    `DTSTAMP:${paraFormatoCalendario(new Date().toISOString())}`,
    `DTSTART:${paraFormatoCalendario(ag.inicio)}`,
    `DTEND:${paraFormatoCalendario(ag.fim)}`,
    `SUMMARY:${escapar(TITULO_EVENTO)}`,
    `DESCRIPTION:${escapar(detalhesEvento(ag.videoLink))}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Consultoria gratuita em 15 minutos',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function baixarIcs(ag: AgendamentoConfirmado): void {
  const blob = new Blob([montarIcs(ag)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'consultoria-gabriel-zaneloti.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
