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

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
  const nome = lead.nome || '';

  // Mensagem de abertura do roteiro de vendas (etapa 1). Só cita o valor de
  // economia quando o cálculo automático rodou de fato (PF com regime eSocial
  // "normal" — ver linhaResultado acima); nos casos sem cálculo automático
  // (PJ, obra antes de 10/2021 etc.) cai numa abertura sem valor, em vez de
  // mostrar "R$ Não calculado" na mensagem.
  const temEconomia =
    lead.economiaEstimada !== null && lead.economiaEstimada !== undefined && !Number.isNaN(Number(lead.economiaEstimada));

  const texto = temEconomia
    ? `Oi ${nome}, tudo bem? Aqui é o Gabriel, vi que você simulou a regularização do INSS da sua obra aqui no site. Pela sua área e tipo de construção, o valor de economia identificado foi de ${formatCurrency(lead.economiaEstimada)} em relação ao que a Receita cobraria sem revisão. Posso te explicar rapidinho de onde vem esse número?`
    : `Oi ${nome}, tudo bem? Aqui é o Gabriel, vi que você simulou a regularização do INSS da sua obra aqui no site. Posso te explicar rapidinho como funciona a redução no seu caso?`;

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

  const avisoEsocialAjustado = detalhe.dataInicioAjustada
    ? `
      <p style="margin:0 0 14px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;color:#92400e;font-size:12px;">
        ⚠️ Obra iniciada antes de 10/2021 (eSocial só obrigatório a partir dessa competência) — cálculo deslocado
        automaticamente para começar em <strong>${escapeHtml(competenciaLabel(detalhe.dataInicioAjustada))}</strong>,
        para tramitar tudo pelo eSocial. A data real de início informada pelo cliente está na tabela acima.
      </p>`
    : '';

  return `
    <div style="margin:28px 0 0;padding-top:20px;border-top:2px dashed #d1d5db;">
      <p style="margin:0 0 4px;display:inline-block;background:#111827;color:#ffffff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:4px;">Uso interno — só você vê isso</p>
      <h3 style="margin:10px 0 4px;font-size:16px;color:#111827;">Detalhamento do cálculo (Fator de Ajuste)</h3>
      <p style="margin:0 0 14px;color:#6b7280;font-size:13px;">
        Área ${formatArea(detalhe.areaM2)} · Fator de Ajuste ${escapeHtml(String(detalhe.percentualFator))}% da RMT ·
        RMT 100% ${formatCurrency(detalhe.rmt100)} · Período com DCTFweb: ${escapeHtml(primeiraCompetencia)} até ${escapeHtml(ultimaCompetencia)}
        (${escapeHtml(String(detalhe.numeroMeses))} meses cobráveis)
      </p>
      ${avisoEsocialAjustado}
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

function slugify(value) {
  const base = String(value || 'lead')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || 'lead';
}

/**
 * ============================================================================
 *  PDF INTERNO — detalhamento completo (Fator de Ajuste), anexado ao e-mail
 * ============================================================================
 * Mesmo conteúdo do bloco "uso interno" que já vai no CORPO do e-mail
 * (`buildDetalheInternoHtml`), só que como arquivo PDF anexado — para o
 * Gabriel guardar junto com a documentação do cliente e usar nos lançamentos
 * mensais, sem precisar copiar do corpo do e-mail toda vez.
 *
 * Gerado com `pdf-lib` (mesma biblioteca usada no PDF público do site, em
 * src/services/pdfReport.ts — aqui rodando em Node, no ambiente serverless da
 * Vercel, já que este arquivo não tem acesso ao build do frontend). Página em
 * formato paisagem para caber as 9 colunas da tabela mensal com folga.
 *
 * Nunca deve derrubar o envio do e-mail: qualquer erro aqui é só registrado
 * no log e o e-mail segue sem anexo.
 * ============================================================================
 */
const PDF_PAGE_WIDTH = 841.89; // A4 paisagem, em pontos
const PDF_PAGE_HEIGHT = 595.28;
const PDF_MARGIN = 40;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const PDF_NAVY = rgb(0.0588, 0.0863, 0.2196);
const PDF_NAVY_LIGHT = rgb(0.4196, 0.4627, 0.6157);
const PDF_RED = rgb(0.6, 0.09, 0.09);

const PDF_TABLE_COLUMNS = [
  { label: 'Mês/Ano', width: 70 },
  { label: 'Rem. Atual', width: 90 },
  { label: 'Rem. Orig.', width: 90 },
  { label: 'CPP', width: 85 },
  { label: 'Multa', width: 85 },
  { label: 'Selic', width: 75 },
  { label: 'Mora', width: 85 },
  { label: 'MAED', width: 85 },
  { label: 'Total', width: 96 },
];

async function buildInternalPdfBase64(lead) {
  const detalhe = lead.detalheInterno;
  if (!detalhe || !Array.isArray(detalhe.linhasComFator) || detalhe.linhasComFator.length === 0) {
    return null;
  }

  try {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    let page = doc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
    let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

    const newPage = () => {
      page = doc.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
      y = PDF_PAGE_HEIGHT - PDF_MARGIN;
    };
    /** Retorna true quando precisou pular de página (usado para redesenhar o cabeçalho da tabela). */
    const ensureSpace = (height) => {
      if (y - height < PDF_MARGIN) {
        newPage();
        return true;
      }
      return false;
    };
    const drawText = (text, x, size, opts = {}) => {
      const { bold = false, color = PDF_NAVY } = opts;
      page.drawText(String(text), { x, y: y - size, size, font: bold ? fontBold : font, color });
    };

    ensureSpace(20);
    drawText('Detalhamento interno — Fator de Ajuste (uso exclusivo, não enviar ao cliente)', PDF_MARGIN, 13, {
      bold: true,
    });
    y -= 20;

    ensureSpace(14);
    drawText(
      `${lead.nome || 'Lead'} · Área ${formatArea(detalhe.areaM2)} · Fator de Ajuste ${detalhe.percentualFator}% da RMT · RMT 100% ${formatCurrency(detalhe.rmt100)}`,
      PDF_MARGIN,
      9,
      { color: PDF_NAVY_LIGHT }
    );
    y -= 16;

    if (detalhe.dataInicioAjustada) {
      ensureSpace(14);
      drawText(
        `Obra iniciada antes de 10/2021 — cálculo deslocado para ${competenciaLabel(detalhe.dataInicioAjustada)} (eSocial).`,
        PDF_MARGIN,
        8,
        { color: PDF_RED }
      );
      y -= 16;
    }
    y -= 6;

    const drawTableHeader = () => {
      ensureSpace(20);
      let x = PDF_MARGIN;
      for (const col of PDF_TABLE_COLUMNS) {
        drawText(col.label, x, 9, { bold: true });
        x += col.width;
      }
      y -= 14;
      page.drawLine({
        start: { x: PDF_MARGIN, y: y + 4 },
        end: { x: PDF_MARGIN + PDF_CONTENT_WIDTH, y: y + 4 },
        thickness: 0.75,
        color: PDF_NAVY_LIGHT,
      });
      y -= 4;
    };

    drawTableHeader();

    for (const linha of detalhe.linhasComFator) {
      const brokePage = ensureSpace(16);
      if (brokePage) drawTableHeader();
      const cells = [
        competenciaLabel(linha.competencia),
        formatCurrency(linha.remAtual),
        formatCurrency(linha.remOrig),
        formatCurrency(linha.cpp),
        formatCurrency(linha.multa),
        formatPercentPrecise(linha.selicPct),
        formatCurrency(linha.mora),
        formatCurrency(linha.maed),
        formatCurrency(linha.total),
      ];
      let x = PDF_MARGIN;
      cells.forEach((cell, index) => {
        drawText(cell, x, 8.5);
        x += PDF_TABLE_COLUMNS[index].width;
      });
      y -= 14;
    }

    y -= 10; // respiro extra entre a última linha da tabela e o total, evita sobreposição visual
    ensureSpace(24);
    page.drawLine({
      start: { x: PDF_MARGIN, y: y + 8 },
      end: { x: PDF_MARGIN + PDF_CONTENT_WIDTH, y: y + 8 },
      thickness: 0.75,
      color: PDF_NAVY_LIGHT,
    });
    drawText('TOTAL (com Fator de Ajuste)', PDF_MARGIN, 9, { bold: true });
    drawText(formatCurrency(lead.valorAposReducao), PDF_MARGIN + PDF_CONTENT_WIDTH - 96, 9, { bold: true });
    y -= 30;

    ensureSpace(60);
    drawText(`Honorários (12% da economia): ${formatCurrency(detalhe.honorarios)}`, PDF_MARGIN, 10, {
      bold: true,
      color: PDF_RED,
    });
    y -= 16;
    drawText(`Redução líquida (para o cliente): ${formatCurrency(detalhe.reducaoLiquida)}`, PDF_MARGIN, 10, {
      bold: true,
      color: PDF_RED,
    });
    y -= 16;
    drawText(
      `Parcelamento estimado: ${detalhe.parcelamento.numeroParcelas}x de ${formatCurrency(detalhe.parcelamento.valorParcela)}`,
      PDF_MARGIN,
      9,
      { color: PDF_NAVY_LIGHT }
    );
    y -= 22;

    ensureSpace(20);
    drawText(
      'Documento de uso interno — nunca enviado ao cliente. Cálculos com desconto de 50% da multa MAED (pagamentos em até 30 dias).',
      PDF_MARGIN,
      7.5,
      { color: PDF_NAVY_LIGHT }
    );

    const bytes = await doc.save();
    return Buffer.from(bytes).toString('base64');
  } catch (error) {
    console.error('[notify-lead] Falha ao gerar PDF interno (e-mail segue sem anexo):', error);
    return null;
  }
}

/**
 * eSocial x GFIP: mesma regra usada no motor do site (src/services/calculateINSS.ts,
 * constantes CORTE_ESOCIAL/INICIO_JANELA_AJUSTE) — mantenha as duas em sincronia se
 * a data de corte mudar. Duplicada aqui porque esta função roda em runtime Node.js
 * separado (Vercel serverless), sem acesso ao build do frontend.
 */
function determinarRegimeApuracao(dataInicio) {
  if (!dataInicio) return 'esocial';
  if (dataInicio >= '2021-10-01') return 'esocial';
  if (dataInicio >= '2021-01-01') return 'esocial_ajustado';
  return 'gfip_anterior_2021';
}

function buildEmailHtml(lead) {
  const regimeApuracao = determinarRegimeApuracao(lead.dataInicio);
  // Fator de Ajuste (IN RFB nº 2.021/2021, art. 33) só se aplica a Pessoa
  // Física — mesma regra usada no ResultCard.tsx do site.
  const isPJ = lead.responsavel === 'PJ';

  const avisoPJ = isPJ
    ? '<p style="margin:0 0 16px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;">⚠️ Obra de Pessoa Jurídica — o Fator de Ajuste (a redução calculada abaixo) NÃO se aplica, só vale para Pessoa Física. No site, este lead viu apenas o "INSS pela aferição indireta" e "Não aplicável" no Fator de Ajuste, com o convite para falar no WhatsApp. Os valores de economia/redução do detalhamento abaixo são só o cálculo de referência (como se fosse PF) — não use como proposta para este cliente; a economia real de uma PJ vem de outras frentes (contabilidade regular, CPRB/Simples Nacional, créditos abatíveis etc.).</p>'
    : '';

  const avisoGfipAnterior =
    !isPJ && regimeApuracao === 'gfip_anterior_2021'
      ? '<p style="margin:0 0 16px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;">⚠️ Obra iniciada antes de 10/2021 — apuração pelo GFIP, mais complexa e sujeita a decadência caso a caso. No site, este lead viu apenas o valor de INSS devido (sem desconto) e o convite para falar no WhatsApp, sem cálculo de redução automático.</p>'
      : '';

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
      ${avisoPJ}
      ${avisoGfipAnterior}
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
    // Gera o PDF do detalhamento interno (se houver dados suficientes) para anexar ao
    // e-mail — nunca deve impedir o envio: em caso de falha, retorna null e o e-mail
    // segue normalmente, só sem o anexo (ver buildInternalPdfBase64).
    const pdfBase64 = await buildInternalPdfBase64(lead);
    const attachments = pdfBase64
      ? [{ filename: `detalhamento-interno-${slugify(lead.nome)}.pdf`, content: pdfBase64 }]
      : undefined;

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
        ...(attachments ? { attachments } : {}),
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
