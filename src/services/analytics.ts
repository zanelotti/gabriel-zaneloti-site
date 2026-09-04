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

let analyticsInitialized = false;

/**
 * Carrega as bibliotecas de analytics (gtag.js para GA4/Google Ads, e o Meta Pixel)
 * de forma dinâmica — SOMENTE se o respectivo ID estiver configurado nas variáveis
 * de ambiente. Sem nenhum ID configurado, nada é carregado e nada é enviado.
 *
 * Chame esta função uma única vez, no início da aplicação (ver src/main.tsx).
 */
export function initAnalytics(): void {
  if (analyticsInitialized || typeof window === 'undefined') return;
  analyticsInitialized = true;

  // GA4 e/ou Google Ads compartilham a mesma biblioteca (gtag.js).
  if (GA4_ID || GOOGLE_ADS_ID) {
    const loaderId = GA4_ID ?? GOOGLE_ADS_ID!;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${loaderId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag('js', new Date());

    if (GA4_ID) window.gtag('config', GA4_ID);
    if (GOOGLE_ADS_ID) window.gtag('config', GOOGLE_ADS_ID);
  }

  // Meta Pixel — loader padrão fornecido pela Meta.
  if (META_PIXEL_ID) {
    type FbqFn = ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
    };

    const win = window as typeof window & {
      fbq: FbqFn;
      _fbq?: unknown;
    };

    if (!win.fbq) {
      const fbqFn: FbqFn = function fbq(...args: unknown[]) {
        if (fbqFn.callMethod) {
          fbqFn.callMethod(...args);
        } else {
          fbqFn.queue!.push(args);
        }
      } as FbqFn;
      fbqFn.queue = [];
      fbqFn.loaded = true;
      fbqFn.version = '2.0';
      win.fbq = fbqFn;
      win._fbq = fbqFn;

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }

    window.fbq?.('init', META_PIXEL_ID);
    window.fbq?.('track', 'PageView');
  }
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
