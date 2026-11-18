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
  document.head.appendChild(s);
}

/** Marca um passo do funil na gravação (ex.: "calculator_step_1_completed"), para filtrar no Clarity. */
export function marcarNoClarity(evento: string): void {
  try {
    window.clarity?.('event', evento);
  } catch {
    /* sem Clarity, sem problema */
  }
}
