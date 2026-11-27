/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — REGISTRO DE VISUALIZAÇÃO DE PÁGINA
 * ============================================================================
 * Chamada pelo frontend (`pageViewTracker.ts`) toda vez que alguém abre uma
 * das páginas públicas do site. Só faz uma coisa: grava a visita na tabela
 * `page_views` do Supabase, pra dar pra acompanhar volume de tráfego sem
 * depender de um plano pago de analytics (ex: Vercel Analytics).
 *
 * Mesmas variáveis de ambiente das outras funções deste projeto
 * (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Se não estiverem configuradas,
 * a chamada é simplesmente ignorada (sem erro) — o carregamento da página
 * nunca depende desta função.
 *
 * Não envia e-mail nenhum (isso geraria um e-mail por visita, o que não faz
 * sentido aqui) — só grava no banco, pra ser consultado depois pela aba
 * "Tráfego" do CRM.
 * ============================================================================
 */

const corta = (v, n) => (v ? String(v).slice(0, n) : null);

/** Campos que existem desde o começo da tabela. */
function camposBasicos(view) {
  return {
    path: String(view.path || '/').slice(0, 500),
    referrer: corta(view.referrer, 500),
    utm_source: corta(view.utmSource, 200),
    utm_medium: corta(view.utmMedium, 200),
    utm_campaign: corta(view.utmCampaign, 200),
    visitor_id: corta(view.visitorId, 100),
    created_at: new Date().toISOString(),
  };
}

/** Campos novos (v50): só gravam depois que o supabase_setup.sql novo rodar; antes disso, a visita é gravada só com os básicos. */
function camposNovos(view, userAgent) {
  const tipo = ['gclid', 'gbraid', 'wbraid'].includes(view.clickId) ? view.clickId : null;
  const tela = Number(view.tela);
  return {
    utm_term: corta(view.utmTerm, 200),
    utm_content: corta(view.utmContent, 200),
    click_id: tipo,
    ref: corta(view.ref, 60),
    interno: view.interno === true,
    tela: Number.isFinite(tela) && tela > 0 && tela < 20000 ? Math.round(tela) : null,
    user_agent: corta(userAgent, 400),
  };
}

async function postar(url, key, linha) {
  return fetch(`${url.replace(/\/$/, '')}/rest/v1/page_views`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(linha),
  });
}

async function saveToSupabase(view, userAgent) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[track-pageview] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas no projeto Vercel.');
    return { ok: false, reason: 'db_not_configured' };
  }

  try {
    const basicos = camposBasicos(view);
    let response = await postar(url, key, { ...basicos, ...camposNovos(view, userAgent) });
    if (!response.ok && (response.status === 400 || response.status === 404)) {
      // Colunas novas ainda não criadas no Supabase: grava só o básico, como antes.
      const detalhe = await response.text();
      if (/column|coluna|PGRST204/i.test(detalhe)) response = await postar(url, key, basicos);
      else response = new Response(detalhe, { status: response.status });
    }

    if (!response.ok) {
      const errorText = await response.text();
      // A tabela pode ainda não existir (supabase_setup.sql não rodado) — registra
      // no log da Vercel, mas nunca derruba a página do visitante.
      console.error('[track-pageview] Falha ao gravar no Supabase:', response.status, errorText);
      return { ok: false, reason: 'db_save_failed' };
    }

    return { ok: true };
  } catch (error) {
    console.error('[track-pageview] Erro inesperado ao gravar no Supabase:', error);
    return { ok: false, reason: 'db_exception' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  let view = req.body;
  if (typeof view === 'string') {
    try {
      view = JSON.parse(view);
    } catch {
      res.status(400).json({ ok: false, reason: 'invalid_body' });
      return;
    }
  }
  if (!view || typeof view !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_body' });
    return;
  }

  const result = await saveToSupabase(view, req.headers?.['user-agent']);
  res.status(200).json(result);
}
