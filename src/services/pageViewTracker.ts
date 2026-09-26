/**
 * ============================================================================
 *  RASTREADOR DE VISUALIZAÇÕES DE PÁGINA (tráfego, sem plano pago)
 * ============================================================================
 * Registra cada visita às páginas públicas do site na tabela `page_views` do
 * seu próprio Supabase, via função serverless `/api/track-pageview` (mesmo
 * padrão de segurança do `leadService.ts`: o navegador nunca escreve direto
 * no banco). Os dados ficam disponíveis na aba "Tráfego" do CRM.
 *
 * Chame `trackPageView()` uma única vez, no início de cada entrada pública
 * do site (ver src/main.tsx, src/sobre/sobre-main.tsx,
 * src/legal/privacidade-main.tsx e src/legal/termos-main.tsx). Não é chamado
 * nas ferramentas internas (calculo.html, crm.html) — só interessa o
 * tráfego de visitantes reais.
 * ============================================================================
 */

const VISITOR_ID_KEY = 'gz_visitor_id';

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Um ID anônimo, salvo no localStorage, reaproveitado nas próximas visitas — só serve pra contar "visitantes únicos", nunca identifica a pessoa. */
function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return generateId();
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;
    const id = generateId();
    window.localStorage.setItem(VISITOR_ID_KEY, id);
    return id;
  } catch {
    // Armazenamento indisponível (modo privado etc.) — segue com um ID novo a cada visita.
    return generateId();
  }
}

function getUtmParam(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get(name) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Registra a visualização da página atual. Fire-and-forget: nunca deve
 * atrapalhar o carregamento da página, mesmo se a tabela ainda não existir
 * no Supabase ou a chamada falhar por qualquer motivo.
 */
export function trackPageView(): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

  const payload = {
    path: window.location.pathname || '/',
    referrer: document.referrer || undefined,
    utmSource: getUtmParam('utm_source'),
    utmMedium: getUtmParam('utm_medium'),
    utmCampaign: getUtmParam('utm_campaign'),
    visitorId: getOrCreateVisitorId(),
  };

  fetch('/api/track-pageview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Falha de rede, função ainda não configurada etc. — nunca deve gerar
    // nenhum erro visível pro visitante.
  });
}
