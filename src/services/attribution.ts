/**
 * ============================================================================
 *  ORIGEM DO CLIQUE (atribuição para Google Ads)
 * ============================================================================
 * Quando alguém chega por um anúncio, o Google Ads acrescenta um identificador
 * de clique à URL (gclid — ou gbraid/wbraid em iPhone). Guardamos esse
 * identificador (e as UTMs) no navegador e enviamos junto no agendamento. É ele
 * que permite, depois, devolver ao Google Ads "este clique virou uma consultoria
 * agendada/realizada" (importação de conversões offline) e montar públicos.
 *
 * Regra: se a URL traz parâmetros de campanha, eles substituem o que estava
 * guardado (vale o último clique — é o que o Google Ads espera). Sem
 * parâmetros, só registramos a página/origem de entrada, se ainda não houver.
 * O registro expira em 90 dias (prazo de validade do gclid).
 * ============================================================================
 */

const STORAGE_KEY = 'gz_attribution';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export interface Attribution {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrer?: string;
  capturedAt?: number;
}

const URL_PARAMS: Array<[keyof Attribution, string]> = [
  ['gclid', 'gclid'],
  ['gbraid', 'gbraid'],
  ['wbraid', 'wbraid'],
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmTerm', 'utm_term'],
  ['utmContent', 'utm_content'],
];

function readStored(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (!parsed.capturedAt || Date.now() - parsed.capturedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: Attribution): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível (modo privado etc.) — segue sem guardar.
  }
}

/** Chame uma vez ao carregar a página (ver src/main.tsx). Nunca lança erro. */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;

  try {
    const search = new URLSearchParams(window.location.search);
    const fromUrl: Attribution = {};
    for (const [key, param] of URL_PARAMS) {
      const value = search.get(param);
      if (value) (fromUrl as Record<string, unknown>)[key] = value.slice(0, 300);
    }

    if (Object.keys(fromUrl).length > 0) {
      writeStored({
        ...fromUrl,
        landingPage: window.location.pathname || '/',
        referrer: document.referrer || undefined,
        capturedAt: Date.now(),
      });
      return;
    }

    if (!readStored()) {
      writeStored({
        landingPage: window.location.pathname || '/',
        referrer: document.referrer || undefined,
        capturedAt: Date.now(),
      });
    }
  } catch {
    // Nunca deve atrapalhar o carregamento da página.
  }
}

/** Origem guardada do visitante (vazia se ainda não houver). */
export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {};
  return readStored() ?? {};
}
