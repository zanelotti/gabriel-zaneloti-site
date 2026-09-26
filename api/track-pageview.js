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

async function saveToSupabase(view) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[track-pageview] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas no projeto Vercel.');
    return { ok: false, reason: 'db_not_configured' };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/page_views`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        path: String(view.path || '/').slice(0, 500),
        referrer: view.referrer ? String(view.referrer).slice(0, 500) : null,
        utm_source: view.utmSource ? String(view.utmSource).slice(0, 200) : null,
        utm_medium: view.utmMedium ? String(view.utmMedium).slice(0, 200) : null,
        utm_campaign: view.utmCampaign ? String(view.utmCampaign).slice(0, 200) : null,
        visitor_id: view.visitorId ? String(view.visitorId).slice(0, 100) : null,
        created_at: new Date().toISOString(),
      }),
    });

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

  const result = await saveToSupabase(view);
  res.status(200).json(result);
}
