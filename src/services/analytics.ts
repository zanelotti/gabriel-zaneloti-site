/**
 * ============================================================================
 *  CAMADA DE ANALYTICS — EVENTOS PREPARADOS PARA GA4 / GOOGLE ADS / META PIXEL
 * ============================================================================
 * Nenhum ID de conta/pixel foi inserido (nenhum valor fictício é aceitável).
 * Preencha as variáveis de ambiente abaixo (arquivo .env, não versionado) e
 * este serviço passará a disparar os eventos automaticamente para as
 * plataformas configuradas.
 *
 *   VITE_GA4_MEASUREMENT_ID=       (ex: G-XXXXXXXXXX)
 *   VITE_GOOGLE_ADS_CONVERSION_ID= (ex: AW-XXXXXXXXX)
 *   VITE_META_PIXEL_ID=            (ex: 000000000000000)
 * ============================================================================
 */

export type AnalyticsEventName =
  | 'click_simular'
  | 'calculator_started'
  | 'calculator_step_1_completed'
  | 'calculator_step_2_completed'
  | 'calculator_completed'
  | 'whatsapp_clicked'
  | 'faq_opened';

export interface AnalyticsEventPayload {
  [key: string]: string | number | boolean | undefined;
}

const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
const GOOGLE_ADS_ID = import.meta.env.VITE_GOOGLE_ADS_CONVERSION_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

function isAnalyticsAvailable(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Dispara um evento de analytics para todas as plataformas configuradas.
 * Se nenhum ID estiver configurado, o evento é apenas registrado no console
 * (modo desenvolvimento), sem erros — nada é enviado para lugar nenhum.
 */
export function trackEvent(name: AnalyticsEventName, payload: AnalyticsEventPayload = {}): void {
  if (!isAnalyticsAvailable()) return;

  if (GA4_ID && typeof window.gtag === 'function') {
    window.gtag('event', name, payload);
  }

  if (GOOGLE_ADS_ID && typeof window.gtag === 'function') {
    window.gtag('event', name, { ...payload, send_to: GOOGLE_ADS_ID });
  }

  if (META_PIXEL_ID && typeof window.fbq === 'function') {
    window.fbq('trackCustom', name, payload);
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${name}`, payload);
  }
}
