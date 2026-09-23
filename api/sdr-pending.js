/**
 * /api/sdr-pending — lista os leads do PILOTO do SDR automatizado que estão
 * ativos (sdr_ativo = true) e ainda em andamento (não fechados/perdidos/
 * pausados), para o robô decidir o que fazer em cada um a cada ciclo.
 *
 * Endpoint privado, chamado só pelo scheduled task do SDR (nunca pelo
 * navegador do visitante) — protegido por um token fixo, não pela chave
 * service_role sozinha.
 *
 * Variáveis de ambiente exigidas (Vercel):
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SDR_API_TOKEN            — token compartilhado só com o scheduled task
 *
 * Importante: esta resposta NUNCA inclui `honorarios`, `valor_fechado` nem
 * `notas` — o robô não deve ter acesso a esses campos internos.
 */

const ESTADOS_ENCERRADOS = ['fechado', 'perdido', 'pausado'];

const CAMPOS_PERMITIDOS = [
  'id',
  'nome',
  'whatsapp',
  'tipo_obra',
  'situacao',
  'categoria',
  'estado',
  'destinacao',
  'area_principal',
  'area_piscina',
  'data_inicio',
  'data_fim',
  'observacoes',
  'inss_estimado',
  'economia_estimada',
  'percentual_reducao',
  'valor_apos_reducao',
  'created_at',
  'sdr_estado',
  'sdr_proximo_contato',
  'sdr_historico',
].join(',');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  const token = req.headers['x-sdr-token'];
  if (!token || token !== process.env.SDR_API_TOKEN) {
    res.status(401).json({ ok: false, reason: 'unauthorized' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ ok: false, reason: 'db_not_configured' });
    return;
  }

  try {
    const estadosExcluidos = ESTADOS_ENCERRADOS.map((s) => `"${s}"`).join(',');
    const query =
      `select=${CAMPOS_PERMITIDOS}` +
      `&sdr_ativo=eq.true` +
      `&sdr_estado=not.in.(${estadosExcluidos})` +
      `&order=created_at.asc`;

    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/leads?${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[sdr-pending] Falha ao consultar o Supabase:', response.status, errorText);
      res.status(502).json({ ok: false, reason: 'db_query_failed' });
      return;
    }

    const leads = await response.json();
    res.status(200).json({ ok: true, leads });
  } catch (error) {
    console.error('[sdr-pending] Erro inesperado:', error);
    res.status(500).json({ ok: false, reason: 'exception' });
  }
}
