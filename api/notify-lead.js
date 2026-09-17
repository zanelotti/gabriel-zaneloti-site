/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — NOTIFICAÇÃO + REGISTRO DE NOVO LEAD
 * ============================================================================
 * Chamada pelo frontend (`leadService.ts`) toda vez que alguém termina uma
 * simulação no site. Faz duas coisas, em paralelo, cada uma independente da
 * outra (uma pode falhar sem afetar a outra):
 *   1. Envia um e-mail para o Gabriel com os dados preenchidos, usando a API
 *      da Resend (https://resend.com).
 *   2. Grava o lead numa tabela do Supabase (https://supabase.com), para
 *      consulta posterior (histórico completo, buscas, filtros).
 *
 * CONFIGURAÇÃO NECESSÁRIA (variáveis de ambiente no projeto Vercel):
 *   - RESEND_API_KEY           (obrigatória p/ e-mail)  — chave da conta Resend.
 *   - LEAD_NOTIFICATION_EMAIL  (opcional)               — e-mail que recebe as notificações.
 *                                                          Se não for definida, usa o padrão abaixo.
 *   - SUPABASE_URL             (obrigatória p/ registro) — Project URL do Supabase.
 *   - SUPABASE_SERVICE_ROLE_KEY(obrigatória p/ registro) — chave "service_role" do Supabase.
 *
 * Se uma das duas integrações ainda não estiver configurada, essa parte é
 * simplesmente pulada (sem erro) — a outra continua funcionando normalmente.
 *
 * Esta função NUNCA deve derrubar a captura do lead no site: qualquer erro
 * aqui é só registrado no log da Vercel (Vercel → projeto → Logs) — o
 * visitante nunca vê nada disso, e o lead já foi salvo antes desta chamada.
 * ============================================================================
 */

const DEFAULT_NOTIFICATION_EMAIL = 'comercial.mfzeng@gmail.com';

const RESPONSAVEL_LABEL = {
  PF: 'Pessoa Física',
  PJ: 'Pessoa Jurídica',
};

const TIPO_OBRA_LABEL = {
  alvenaria: 'Alvenaria',
  madeira: 'Madeira',
  mista: 'Mista',
};

const SITUACAO_LABEL = {
  concluida_com_habite_se: 'Concluída com Habite-se',
  concluida_sem_habite_se: 'Concluída sem Habite-se',
  em_construcao: 'Em construção',
  iniciar_em_breve: 'Iniciar em breve',
  construida_ha_mais_de_5_anos: 'Construída há mais de 5 anos',
};

const DESTINACAO_LABEL = {
  residencial_unifamiliar: 'Residencial unifamiliar',
  multifamiliar: 'Multifamiliar',
  comercial_salas_lojas: 'Comercial — salas e lojas',
  galpao_industrial: 'Galpão industrial',
  conjunto_habitacional: 'Conjunto habitacional',
  edificio_garagem: 'Edifício garagem',
};

const CATEGORIA_LABEL = {
  obra_nova: 'Obra nova',
  acrescimo: 'Acréscimo',
  reforma: 'Reforma',
  demolicao: 'Demolição',
};

const BRAZILIAN_STATES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não calculado';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não calculado';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

/** Percentual com sempre 2 casas decimais (ex: 57,53%) — usado na tabela mensal, onde a precisão importa. */
function formatPercentPrecise(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não calculado';
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/** Converte a chave de competência "AAAA-MM" para o rótulo "MM/AAAA". */
function competenciaLabel(competencia) {
  const [year, month] = String(competencia).split('-');
  if (!year || !month) return String(competencia ?? '');
  return `${month}/${year}`;
}

function formatDateBR(isoDate) {
  if (!isoDate) return 'Não informado';
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return 'Não informado';
  return `${day}/${month}/${year}`;
}

function formatArea(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não informado';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

function estadoLabel(uf) {
  if (!uf) return 'Não informado';
  const nome = BRAZILIAN_STATES[uf];
  return nome ? `${uf} — ${nome}` : uf;
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function buildWhatsAppLink(lead) {
  const digits = onlyDigits(lead.whatsapp);
  if (!digits) return null;
  // Assume DDD + número informados sem o 55 do Brasil, como o campo do site pede.
  const numero = digits.length <= 11 ? `55${digits}` : digits;
  const texto = `Olá, ${lead.nome || ''}! Vi que você simulou a redução do INSS da sua obra no meu site.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/**
 * Renderiza o detalhamento interno do cálculo (lançamentos mensais + honorários
 * de 12% sobre a economia + redução líquida), no mesmo formato dos relatórios
 * internos do Gabriel (`/calculo.html`). Só aparece para quem recebe este
 * e-mail — nunca é exibido para o visitante do site, que só vê os 4 números
 * resumidos no resultado da calculadora pública.
 */
function buildDetalheInternoHtml(lead) {
  const detalhe = lead.detalheInterno;
  if (!detalhe || !Array.isArray(detalhe.linhasComFator) || detalhe.linhasComFator.length === 0) {
    return '';
  }

  const linhasHtml = detalhe.linhasComFator
    .map(
      (linha, index) => `
        <tr style="background:${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111827;white-space:nowrap;">${escapeHtml(competenciaLabel(linha.competencia))}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatCurrency(linha.remAtual)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatCurrency(linha.remOrig)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatCurrency(linha.cpp)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatCurrency(linha.multa)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatPercentPrecise(linha.selicPct)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatCurrency(linha.mora)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${formatCurrency(linha.maed)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827;white-space:nowrap;">${formatCurrency(linha.total)}</td>
        </tr>`
    )
    .join('');

  const primeiraCompetencia = competenciaLabel(detalhe.linhasComFator[0].competencia);
  const ultimaCompetencia = competenciaLabel(detalhe.linhasComFator[detalhe.linhasComFator.length - 1].competencia);

  return `
    <div style="margin:28px 0 0;padding-top:20px;border-top:2px dashed #d1d5db;">
      <p style="margin:0 0 4px;display:inline-block;background:#111827;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:4px;">Uso interno — só você vê isso</p>
      <h3 style="margin:10px 0 4px;font-size:16px;color:#111827;">Detalhamento do cálculo (Fator de Ajuste)</h3>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;">
        Área ${formatArea(detalhe.areaM2)} · Fator de Ajuste ${escapeHtml(String(detalhe.percentualFator))}% da RMT ·
        RMT 100% ${formatCurrency(detalhe.rmt100)} · Período com DCTFweb: ${escapeHtml(primeiraCompetencia)} até ${escapeHtml(ultimaCompetencia)}
        (${escapeHtml(String(detalhe.numeroMeses))} meses cobráveis)
      </p>
      <div style="overflow-x:auto;">
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:12px;min-width:560px;">
          <thead>
            <tr style="background:#111827;color:#ffffff;text-align:left;">
              <th style="padding:6px 8px;font-weight:700;">Mês/Ano</th>
              <th style="padding:6px 8px;font-weight:700;">Rem. Atual</th>
              <th style="padding:6px 8px;font-weight:700;">Rem. Orig.</th>
              <th style="padding:6px 8px;font-weight:700;">CPP</th>
              <th style="padding:6px 8px;font-weight:700;">Multa</th>
              <th style="padding:6px 8px;font-weight:700;">Selic</th>
              <th style="padding:6px 8px;font-weight:700;">Mora</th>
              <th style="padding:6px 8px;font-weight:700;">MAED</th>
              <th style="padding:6px 8px;font-weight:700;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linhasHtml}
          </tbody>
          <tfoot>
            <tr style="background:#1f2937;color:#ffffff;font-weight:700;">
              <td style="padding:6px 8px;" colspan="8">TOTAL (com Fator de Ajuste)</td>
              <td style="padding:6px 8px;">${formatCurrency(lead.valorAposReducao)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <table role="presentation" width="100%" style="border-collapse:collapse;margin:16px 0 0;">
        <tr>
          <td style="padding:10px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px 0 0 8px;">
            <div style="font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:.03em;">Honorários (12% da economia)</div>
            <div style="font-size:18px;font-weight:700;color:#7f1d1d;">${formatCurrency(detalhe.honorarios)}</div>
          </td>
          <td style="padding:10px 16px;background:#fef2f2;border:1px solid #fecaca;border-left:none;border-radius:0 8px 8px 0;">
            <div style="font-size:12px;color:#991b1b;text-transform:uppercase;letter-spacing:.03em;">Redução líquida (para o cliente)</div>
            <div style="font-size:18px;font-weight:700;color:#7f1d1d;">${formatCurrency(detalhe.reducaoLiquida)}</div>
          </td>
        </tr>
      </table>

      <p style="margin:10px 0 0;color:#6b7280;font-size:13px;">
        Parcelamento estimado: ${escapeHtml(String(detalhe.parcelamento.numeroParcelas))}x de ${formatCurrency(detalhe.parcelamento.valorParcela)}.
      </p>
      <p style="margin:10px 0 0;color:#9ca3af;font-size:11px;">
        Cálculos com base no desconto de 50% da multa da MAED, para pagamentos em até 30 dias. Este detalhamento é só
        para uso interno — nunca aparece para quem preenche a calculadora no site.
      </p>
    </div>`;
}

function buildEmailHtml(lead) {
  const linhaResultado =
    lead.inssEstimado === null
      ? '<p style="margin:0 0 16px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">Não foi possível gerar uma estimativa automática para os dados informados — vale entrar em contato para entender o caso.</p>'
      : `
        <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 20px;">
          <tr>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px 0 0 8px;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">INSS estimado antes</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatCurrency(lead.inssEstimado)}</div>
            </td>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:none;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Economia estimada</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatCurrency(lead.economiaEstimada)}</div>
            </td>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:none;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Redução</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatPercent(lead.percentualReducao)}</div>
            </td>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:none;border-radius:0 8px 8px 0;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Após redução</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatCurrency(lead.valorAposReducao)}</div>
            </td>
          </tr>
        </table>`;

  const whatsappLink = buildWhatsAppLink(lead);

  const linhas = [
    ['Nome', lead.nome || 'Não informado'],
    ['WhatsApp', lead.whatsapp || 'Não informado'],
    ['Início da obra', formatDateBR(lead.dataInicio)],
    ['Fim da obra', formatDateBR(lead.dataFim)],
    ['Responsável', RESPONSAVEL_LABEL[lead.responsavel] || 'Não informado'],
    ['Tipo de obra', TIPO_OBRA_LABEL[lead.tipoObra] || 'Não informado'],
    ['Situação', SITUACAO_LABEL[lead.situacao] || 'Não informado'],
    ['Categoria da obra', CATEGORIA_LABEL[lead.categoria] || 'Não informado'],
    ['Estado', estadoLabel(lead.estado)],
    ['Destinação', DESTINACAO_LABEL[lead.destinacao] || 'Não informado'],
    ['Área principal', formatArea(lead.areaPrincipal)],
    ['Área complementar (piscina etc.)', formatArea(lead.areaPiscina)],
  ];

  if (lead.observacoes) {
    linhas.push(['Observações', lead.observacoes]);
  }

  const linhasHtml = linhas
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
      <h2 style="margin:0 0 4px;font-size:20px;">Nova simulação no site 🎯</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${escapeHtml(lead.nome || 'Alguém')} acabou de preencher a calculadora de INSS de obras.</p>
      ${linhaResultado}
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
        ${linhasHtml}
      </table>
      ${
        whatsappLink
          ? `<a href="${whatsappLink}" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">Chamar ${escapeHtml(lead.nome || 'lead')} no WhatsApp</a>`
          : ''
      }
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">Simulação recebida em ${new Date(lead.createdAt || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário de Brasília).</p>
      ${buildDetalheInternoHtml(lead)}
    </div>`;
}

/** Converte o lead (camelCase, como chega do frontend) para as colunas snake_case da tabela `leads` do Supabase. */
function toSupabaseRow(lead) {
  return {
    id: lead.id || undefined,
    nome: lead.nome ?? null,
    whatsapp: lead.whatsapp ?? null,
    data_inicio: lead.dataInicio || null,
    data_fim: lead.dataFim || null,
    responsavel: lead.responsavel ?? null,
    tipo_obra: lead.tipoObra ?? null,
    situacao: lead.situacao ?? null,
    categoria: lead.categoria ?? null,
    estado: lead.estado ?? null,
    destinacao: lead.destinacao ?? null,
    area_principal: lead.areaPrincipal ?? null,
    area_piscina: lead.areaPiscina ?? null,
    observacoes: lead.observacoes || null,
    inss_estimado: lead.inssEstimado ?? null,
    economia_estimada: lead.economiaEstimada ?? null,
    percentual_reducao: lead.percentualReducao ?? null,
    valor_apos_reducao: lead.valorAposReducao ?? null,
    created_at: lead.createdAt || new Date().toISOString(),
  };
}

/**
 * Grava o lead na tabela `leads` do Supabase, via API REST (PostgREST),
 * usando a chave service_role (só existe aqui, do lado do servidor — nunca
 * é exposta ao navegador do visitante).
 */
async function saveToSupabase(lead) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[notify-lead] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configuradas no projeto Vercel.');
    return { ok: false, reason: 'db_not_configured' };
  }

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(toSupabaseRow(lead)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[notify-lead] Falha ao gravar no Supabase:', response.status, errorText);
      return { ok: false, reason: 'db_save_failed' };
    }

    return { ok: true };
  } catch (error) {
    console.error('[notify-lead] Erro inesperado ao gravar no Supabase:', error);
    return { ok: false, reason: 'db_exception' };
  }
}

/** Envia o e-mail de notificação via Resend. Retorna sempre um resultado, nunca lança. */
async function sendEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[notify-lead] RESEND_API_KEY não configurada no projeto Vercel.');
    return { ok: false, reason: 'email_not_configured' };
  }

  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Simulador INSS de Obras <onboarding@resend.dev>',
        to: [toEmail],
        reply_to: toEmail,
        subject: `Nova simulação: ${lead.nome || 'Visitante do site'}`,
        html: buildEmailHtml(lead),
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('[notify-lead] Falha ao enviar via Resend:', resendResponse.status, errorText);
      return { ok: false, reason: 'send_failed' };
    }

    return { ok: true };
  } catch (error) {
    console.error('[notify-lead] Erro inesperado ao enviar e-mail:', error);
    return { ok: false, reason: 'exception' };
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

  let lead = req.body;
  if (typeof lead === 'string') {
    try {
      lead = JSON.parse(lead);
    } catch {
      res.status(400).json({ ok: false, reason: 'invalid_body' });
      return;
    }
  }
  if (!lead || typeof lead !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_body' });
    return;
  }

  // As duas integrações rodam em paralelo e são independentes: uma falhar
  // (ou ainda não estar configurada) não afeta a outra.
  const [email, db] = await Promise.all([sendEmail(lead), saveToSupabase(lead)]);

  res.status(200).json({ ok: email.ok || db.ok, email, db });
}
