/**
 * Microsoft Clarity: gravações das visitas e mapas de calor, para ver onde as pessoas param no site.
 * Para ligar: crie o projeto em clarity.microsoft.com e cole aqui o "Project ID" (Settings > Overview).
 * Vazio = o Clarity não carrega.
 */
export const CLARITY_ID = 'zfsbk2oeyv';

declare global {
  interface Window {
    clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
  }
}

import { getAttribution } from './attribution';
import { depoisDeCarregar } from './depoisDeCarregar';

/** De onde veio a visita, para filtrar as gravações no Clarity (filtro "Etiquetas personalizadas" > origem). */
function origemDaVisita(): { origem: string; campanha?: string } {
  try {
    const a = getAttribution() as Record<string, string | undefined>;
    const campanha = a.utmCampaign || undefined;
    if (a.gclid || a.gbraid || a.wbraid) return { origem: 'google_ads', campanha };
    if (a.utmSource) return { origem: `${a.utmSource}${a.utmMedium ? `_${a.utmMedium}` : ''}`, campanha };
    const ref = document.referrer || '';
    if (/google\./i.test(ref)) return { origem: 'google_organico' };
    if (/facebook|instagram/i.test(ref)) return { origem: 'redes_sociais' };
    if (ref && !ref.includes(location.hostname)) return { origem: 'outro_site' };
    return { origem: 'direto' };
  } catch {
    return { origem: 'desconhecida' };
  }
}

export function initClarity(): void {
  if (!CLARITY_ID || typeof window === 'undefined' || window.clarity) return;
  // Fila de comandos até o script carregar (mesmo comportamento do código oficial do Clarity).
  const fila = function (...args: unknown[]) {
    (fila.q = fila.q || []).push(args);
  } as ((...args: unknown[]) => void) & { q?: unknown[] };
  window.clarity = fila;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  depoisDeCarregar(() => document.head.appendChild(s), 300);
  const { origem, campanha } = origemDaVisita();
  window.clarity('set', 'origem', origem);
  if (campanha) window.clarity('set', 'campanha', campanha);
}

/** Marca um passo do funil na gravação (ex.: "calculator_step_1_completed"), para filtrar no Clarity. */
export function marcarNoClarity(evento: string): void {
  try {
    window.clarity?.('event', evento);
  } catch {
    /* sem Clarity, sem problema */
  }
}
