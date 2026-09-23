/**
 * ============================================================================
 *  PDF PÚBLICO DE DIAGNÓSTICO — gerado no navegador (client-side)
 * ============================================================================
 * Monta um PDF com o resumo da simulação que o próprio lead preencheu (mesmos
 * dados exibidos no ResultCard), estilizado com as cores da marca (cabeçalho
 * navy, cards de resultado, comparativo em barras e a foto do Gabriel como
 * assinatura visual), para ele baixar e guardar.
 *
 * IMPORTANTE: este PDF é público — nunca deve conter honorários. Por isso a
 * função só lê os campos "seguros" de INSSResult (inssEstimado,
 * valorAposReducao, percentualReducao, economiaEstimada, regimeApuracao) e
 * NUNCA toca em `result.detalheInterno` (onde ficam honorários/parcelamento),
 * mesmo que esse campo esteja presente no objeto em memória.
 *
 * Usa a biblioteca `pdf-lib` (pura JS/TS, roda no navegador sem dependências
 * nativas). O equivalente para o PDF interno (anexado ao e-mail do Gabriel,
 * com o detalhamento completo) vive em api/notify-lead.js, gerado no servidor
 * com a mesma biblioteca.
 * ============================================================================
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import type { CalculatorData, INSSResult } from '@/types/calculator';
import { formatArea, formatCurrency, formatDateBR, formatPercent } from '@/utils/formatters';
import { WHATSAPP_NUMBER_DISPLAY } from '@/services/whatsapp';
import {
  CATEGORIA_LABEL,
  DESTINACAO_LABEL,
  RESPONSAVEL_LABEL,
  SITUACAO_LABEL,
  TIPO_OBRA_LABEL,
  estadoLabel,
} from '@/utils/labels';

const PAGE_WIDTH = 595.28; // A4 em pontos
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 122;
const FOOTER_HEIGHT = 30;

// Mesma paleta de src/tailwind.config.js (navy / accent / amber).
const WHITE = rgb(1, 1, 1);
const NAVY_950 = rgb(0.0392, 0.0588, 0.1569);
const NAVY_900 = rgb(0.0588, 0.0863, 0.2196);
const NAVY_500 = rgb(0.2275, 0.2902, 0.5608);
const NAVY_300 = rgb(0.5176, 0.5765, 0.7765);
const NAVY_100 = rgb(0.8392, 0.8588, 0.9255);
const NAVY_50 = rgb(0.9333, 0.9412, 0.9686);
const NAVY_HEADER_SUBTEXT = rgb(0.7333, 0.7608, 0.851);
const ACCENT_700 = rgb(0.2941, 0.4157, 0.102);
const ACCENT_400 = rgb(0.5765, 0.7882, 0.2275);
const ACCENT_50 = rgb(0.9569, 0.9765, 0.9137);
const ACCENT_200 = rgb(0.8, 0.898, 0.6);
const AMBER_500 = rgb(0.9686, 0.5725, 0.0588);
const AMBER_50 = rgb(1, 0.9725, 0.9255);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Busca a foto do Gabriel (mesma usada no site, `public/gabriel-zaneloti.jpg`)
 * para usar como assinatura visual no cabeçalho. Nunca deve travar a geração
 * do PDF — se a foto não carregar por qualquer motivo, o cabeçalho é
 * desenhado sem ela.
 */
async function loadLogoImage(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const response = await fetch('/gabriel-zaneloti.jpg');
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

/** Cursor simples de desenho — controla posição vertical e cria novas páginas quando o conteúdo não cabe. */
class PdfCursor {
  page: PDFPage;
  y: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly fontBold: PDFFont,
    initialPage: PDFPage,
    initialY: number
  ) {
    this.page = initialPage;
    this.y = initialY;
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  /**
   * Público: usado também de fora da classe (ver montagem manual da grade de dados/cards de resultado).
   * Só reserva a margem inferior — a faixa do rodapé (FOOTER_HEIGHT) é reservada explicitamente só antes
   * do bloco de CTA (ver `ensureSpaceForFooter`), pra não perder espaço útil em toda página à toa.
   */
  ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.newPage();
    }
  }

  /** Garante espaço para `height` de conteúdo + a faixa do rodapé — usar só antes do bloco final (CTA). */
  ensureSpaceForFooter(height: number) {
    this.ensureSpace(height + FOOTER_HEIGHT);
  }

  spacer(height: number) {
    this.y -= height;
  }

  line(color = NAVY_100) {
    this.ensureSpace(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 1,
      color,
    });
    this.y -= 10;
  }

  text(
    value: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}
  ) {
    const { size = 10, bold = false, color = NAVY_900, gap = 5 } = opts;
    const font = bold ? this.fontBold : this.font;
    this.ensureSpace(size + gap);
    this.page.drawText(value, { x: MARGIN, y: this.y - size, size, font, color });
    this.y -= size + gap;
  }

  paragraph(value: string, opts: { size?: number; color?: ReturnType<typeof rgb>; gap?: number } = {}) {
    const { size = 9, color = NAVY_500, gap = 3 } = opts;
    const lines = wrapText(value, this.font, size, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensureSpace(size + gap);
      this.page.drawText(line, { x: MARGIN, y: this.y - size, size, font: this.font, color });
      this.y -= size + gap;
    }
  }

  /** Retângulo (card) desenhado a partir do y atual, sem mover o cursor — quem chama controla o avanço. */
  panel(
    height: number,
    opts: { fill?: ReturnType<typeof rgb>; border?: ReturnType<typeof rgb>; borderWidth?: number } = {}
  ) {
    this.ensureSpace(height);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height,
      width: CONTENT_WIDTH,
      height,
      color: opts.fill,
      borderColor: opts.border,
      borderWidth: opts.border ? (opts.borderWidth ?? 1) : 0,
    });
  }
}

function buildDataFields(data: CalculatorData): Array<[string, string]> {
  const fields: Array<[string, string]> = [
    ['Nome', data.nome || 'Não informado'],
    ['WhatsApp', data.whatsapp || 'Não informado'],
    ['Responsável', RESPONSAVEL_LABEL[data.responsavel] ?? 'Não informado'],
    ['Início da obra', formatDateBR(data.dataInicio)],
    ['Fim da obra', data.dataFim ? formatDateBR(data.dataFim) : 'Obra em andamento'],
    ['Situação da obra', SITUACAO_LABEL[data.situacao] ?? 'Não informado'],
    ['Categoria da obra', CATEGORIA_LABEL[data.categoria] ?? 'Não informado'],
    ['Tipo construtivo', TIPO_OBRA_LABEL[data.tipoObra] ?? 'Não informado'],
    ['Destinação', DESTINACAO_LABEL[data.destinacao] ?? 'Não informado'],
    ['Estado', estadoLabel(data.estado)],
    ['Área principal', formatArea(data.areaPrincipal)],
    ['Área complementar (piscina etc.)', formatArea(data.areaPiscina)],
  ];
  return fields;
}

/** Desenha o cabeçalho de marca (faixa navy + faixa accent + foto) na primeira página. */
function drawBrandHeader(page: PDFPage, font: PDFFont, fontBold: PDFFont, logoImage: PDFImage | null) {
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_HEIGHT, width: PAGE_WIDTH, height: HEADER_HEIGHT, color: NAVY_950 });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_HEIGHT - 3, width: PAGE_WIDTH, height: 3, color: ACCENT_400 });

  page.drawText('GABRIEL ZANELOTI', { x: MARGIN, y: PAGE_HEIGHT - 44, size: 21, font: fontBold, color: WHITE });
  page.drawText('PLANEJAMENTO TRIBUTÁRIO · INSS DE OBRAS', {
    x: MARGIN,
    y: PAGE_HEIGHT - 60,
    size: 8.5,
    font: fontBold,
    color: ACCENT_400,
  });
  page.drawText('Diagnóstico Inicial de INSS de Obra', {
    x: MARGIN,
    y: PAGE_HEIGHT - 86,
    size: 13,
    font,
    color: WHITE,
  });
  page.drawText(`Gerado em ${new Date().toLocaleDateString('pt-BR')} a partir da simulação preenchida no site.`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 102,
    size: 8,
    font,
    color: NAVY_HEADER_SUBTEXT,
  });

  if (logoImage) {
    const size = 72;
    const x = PAGE_WIDTH - MARGIN - size;
    const y = PAGE_HEIGHT - HEADER_HEIGHT / 2 - size / 2;
    page.drawRectangle({ x: x - 4, y: y - 4, width: size + 8, height: size + 8, color: ACCENT_400 });
    const dims = logoImage.scale(1);
    const scale = size / Math.max(dims.width, dims.height);
    const drawWidth = dims.width * scale;
    const drawHeight = dims.height * scale;
    page.drawImage(logoImage, {
      x: x + (size - drawWidth) / 2,
      y: y + (size - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }
}

/** Comparativo visual em barras (mesmo conceito do BeforeAfterBars.tsx da página de resultado). */
function drawBarComparison(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  x: number,
  topY: number,
  width: number,
  antes: number,
  depois: number
) {
  const maxValue = Math.max(antes, depois, 1);
  const barHeight = 10;
  const rows: Array<[string, number, ReturnType<typeof rgb>]> = [
    ['Valor presumido pela Receita Federal', antes, NAVY_300],
    ['Valor estimado após a redução legal', depois, ACCENT_400],
  ];

  let y = topY;
  rows.forEach(([label, value, color], index) => {
    const valueStr = formatCurrency(value);
    page.drawText(label.toUpperCase(), { x, y: y - 7, size: 7.5, font, color: NAVY_300 });
    page.drawText(valueStr, {
      x: x + width - fontBold.widthOfTextAtSize(valueStr, 9),
      y: y - 7,
      size: 9,
      font: fontBold,
      color: NAVY_900,
    });
    y -= 13;
    // trilha (fundo) da barra
    page.drawRectangle({ x, y: y - barHeight, width, height: barHeight, color: NAVY_50 });
    // preenchimento proporcional
    const fillWidth = Math.max(10, (value / maxValue) * width);
    page.drawRectangle({ x, y: y - barHeight, width: fillWidth, height: barHeight, color });
    y -= barHeight;
    if (index < rows.length - 1) y -= 10;
  });
}

/**
 * Gera os bytes do PDF de diagnóstico público. Só lê os campos "seguros" de
 * `result` (nunca `result.detalheInterno`) — ver aviso no topo do arquivo.
 */
export async function generateLeadPdfBytes(data: CalculatorData, result: INSSResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = await loadLogoImage(doc);

  const firstPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawBrandHeader(firstPage, font, fontBold, logoImage);

  const cursor = new PdfCursor(doc, font, fontBold, firstPage, PAGE_HEIGHT - HEADER_HEIGHT - 24);

  // ---- Dados da obra (painel cinza-claro) ----
  cursor.text('Dados da obra informados', { size: 12, bold: true, gap: 12 });

  const fields = buildDataFields(data);
  const rows = Math.ceil(fields.length / 2);
  const rowHeight = 25;
  const obsLines = data.observacoes ? wrapText(data.observacoes, font, 8.5, CONTENT_WIDTH - 24) : [];
  const panelHeight = 16 + rows * rowHeight + (data.observacoes ? 20 + obsLines.length * 12 + 10 : 6);

  cursor.panel(panelHeight, { fill: NAVY_50, border: NAVY_100, borderWidth: 1 });
  const panelTop = cursor.y - 14;
  for (let i = 0; i < fields.length; i += 2) {
    const [label1, value1] = fields[i];
    const [label2, value2] = fields[i + 1] ?? [null, null];
    const rowY = panelTop - (i / 2) * rowHeight;
    cursor.page.drawText(label1.toUpperCase(), { x: MARGIN + 14, y: rowY - 7.5, size: 7.5, font, color: NAVY_300 });
    cursor.page.drawText(value1, { x: MARGIN + 14, y: rowY - 19.5, size: 9.5, font: fontBold, color: NAVY_900 });
    if (label2 && value2) {
      const colX = MARGIN + 14 + CONTENT_WIDTH / 2;
      cursor.page.drawText(label2.toUpperCase(), { x: colX, y: rowY - 7.5, size: 7.5, font, color: NAVY_300 });
      cursor.page.drawText(value2, { x: colX, y: rowY - 19.5, size: 9.5, font: fontBold, color: NAVY_900 });
    }
  }

  if (data.observacoes) {
    const obsTop = panelTop - rows * rowHeight - 6;
    cursor.page.drawText('OBSERVAÇÕES', { x: MARGIN + 14, y: obsTop, size: 7.5, font, color: NAVY_300 });
    obsLines.forEach((line, index) => {
      cursor.page.drawText(line, {
        x: MARGIN + 14,
        y: obsTop - 12 - index * 12,
        size: 8.5,
        font,
        color: NAVY_500,
      });
    });
  }

  cursor.y -= panelHeight + 14;

  // ---- Resultado da simulação ----
  cursor.text('Resultado da simulação', { size: 12, bold: true, gap: 10 });

  // Mesma lógica de ramificação usada em ResultCard.tsx — mantenha sincronizado se ela mudar lá.
  const fatorAjusteNaoAplicavel = data.responsavel === 'PJ';
  const exigeAnaliseManual = !fatorAjusteNaoAplicavel && result.regimeApuracao === 'gfip_anterior_2021';

  if (fatorAjusteNaoAplicavel || exigeAnaliseManual) {
    const label = fatorAjusteNaoAplicavel ? 'INSS pela aferição indireta' : 'INSS devido estimado (sem redução)';
    const explicacao = fatorAjusteNaoAplicavel
      ? 'O Fator de Ajuste (a redução legal aplicada nas obras de Pessoa Física) não se aplica a obras de Pessoa ' +
        'Jurídica. Para PJ, a economia vem de outras frentes específicas da empresa — fale com o Gabriel para uma ' +
        'análise personalizada.'
      : 'Obra iniciada antes de outubro de 2021 — período apurado pelo GFIP, com regras próprias que exigem uma ' +
        'análise manual detalhada para calcular a redução aplicável.';

    cursor.panel(70, { fill: WHITE, border: NAVY_100, borderWidth: 1 });
    const cardTop = cursor.y - 16;
    cursor.page.drawText(label.toUpperCase(), { x: MARGIN + 14, y: cardTop - 8, size: 7.5, font, color: NAVY_300 });
    cursor.page.drawText(formatCurrency(result.inssEstimado), {
      x: MARGIN + 14,
      y: cardTop - 26,
      size: 18,
      font: fontBold,
      color: NAVY_900,
    });
    cursor.y -= 70 + 14;

    const explLines = wrapText(explicacao, font, 8.5, CONTENT_WIDTH - 24);
    const explPanelHeight = 20 + explLines.length * 12;
    cursor.panel(explPanelHeight, { fill: AMBER_50, border: AMBER_500, borderWidth: 1 });
    const explTop = cursor.y - 14;
    explLines.forEach((line, index) => {
      cursor.page.drawText(line, { x: MARGIN + 14, y: explTop - index * 12, size: 8.5, font, color: NAVY_900 });
    });
    cursor.y -= explPanelHeight + 18;
  } else {
    // 4 cards em grade 2x2: linha de cima neutra, linha de baixo em destaque (accent) — mesmas cores do site.
    cursor.ensureSpace(140);
    const cardGap = 8;
    const cardWidth = (CONTENT_WIDTH - cardGap) / 2;
    const cardHeight = 52;
    const gridTop = cursor.y;
    const cells: Array<[string, string, boolean]> = [
      ['INSS estimado antes da análise', formatCurrency(result.inssEstimado), false],
      ['Valor estimado após redução', formatCurrency(result.valorAposReducao), false],
      ['Redução estimada', formatPercent(result.percentualReducao), true],
      ['Economia estimada', formatCurrency(result.economiaEstimada), true],
    ];
    cells.forEach(([label, value, highlight], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + col * (cardWidth + cardGap);
      const yTop = gridTop - row * (cardHeight + cardGap);
      cursor.page.drawRectangle({
        x,
        y: yTop - cardHeight,
        width: cardWidth,
        height: cardHeight,
        color: highlight ? ACCENT_50 : WHITE,
        borderColor: highlight ? ACCENT_200 : NAVY_100,
        borderWidth: 1,
      });
      cursor.page.drawText(label.toUpperCase(), { x: x + 12, y: yTop - 18, size: 7, font, color: NAVY_300 });
      cursor.page.drawText(value, {
        x: x + 12,
        y: yTop - 40,
        size: 15,
        font: fontBold,
        color: highlight ? ACCENT_700 : NAVY_900,
      });
    });
    cursor.y = gridTop - 2 * (cardHeight + cardGap) + cardGap - 6;

    // Comparativo em barras.
    cursor.ensureSpace(86);
    const chartPanelHeight = 78;
    cursor.panel(chartPanelHeight, { fill: WHITE, border: NAVY_100, borderWidth: 1 });
    drawBarComparison(
      cursor.page,
      font,
      fontBold,
      MARGIN + 14,
      cursor.y - 14,
      CONTENT_WIDTH - 28,
      result.inssEstimado,
      result.valorAposReducao
    );
    cursor.y -= chartPanelHeight + 10;

    const rodape = wrapText(
      'Seguindo a Instrução Normativa RFB nº 2021/2021, é possível reduzir legalmente o valor do INSS presumido pela Receita Federal para a sua obra.',
      font,
      7.5,
      CONTENT_WIDTH
    );
    rodape.forEach((line) => {
      cursor.ensureSpace(10);
      cursor.page.drawText(line, { x: MARGIN, y: cursor.y - 7.5, size: 7.5, font, color: NAVY_300 });
      cursor.y -= 10;
    });
    cursor.y -= 4;
  }

  cursor.line();
  cursor.spacer(6);
  cursor.paragraph(
    'Este resultado é uma estimativa inicial calculada com base nos dados informados e não substitui uma análise ' +
      'técnica e tributária completa da documentação da obra. Os honorários (uma porcentagem sobre a economia ' +
      'comprovada ou, quando não há redução a aplicar, um valor mínimo conforme a complexidade do processo) são ' +
      'apresentados em uma proposta específica, após conversa direta com o Gabriel.',
    { size: 8, color: NAVY_300, gap: 2 }
  );
  cursor.spacer(4);

  // ---- Botão de CTA (cor amber, igual ao botão primário do site) ----
  const ctaHeight = 36;
  cursor.ensureSpaceForFooter(ctaHeight + 10);
  cursor.page.drawRectangle({
    x: MARGIN,
    y: cursor.y - ctaHeight,
    width: CONTENT_WIDTH,
    height: ctaHeight,
    color: AMBER_500,
  });
  const ctaLabel = 'Fale com o Gabriel no WhatsApp para confirmar essa economia';
  const ctaSize = 11;
  const ctaWidth = fontBold.widthOfTextAtSize(ctaLabel, ctaSize);
  cursor.page.drawText(ctaLabel, {
    x: MARGIN + (CONTENT_WIDTH - ctaWidth) / 2,
    y: cursor.y - ctaHeight / 2 - ctaSize / 2 + 2,
    size: ctaSize,
    font: fontBold,
    color: NAVY_950,
  });
  cursor.y -= ctaHeight + 14;

  // ---- Rodapé de contato (faixa navy, no fim da última página usada) ----
  cursor.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: FOOTER_HEIGHT, color: NAVY_950 });
  cursor.page.drawText(`comercial.mfzeng@gmail.com  ·  WhatsApp ${WHATSAPP_NUMBER_DISPLAY}`, {
    x: MARGIN,
    y: 11,
    size: 8,
    font,
    color: NAVY_HEADER_SUBTEXT,
  });

  return doc.save();
}

/** Gera o PDF e dispara o download no navegador. */
export async function downloadLeadPdf(data: CalculatorData, result: INSSResult): Promise<void> {
  const bytes = await generateLeadPdfBytes(data, result);
  // `bytes` vem tipado como Uint8Array<ArrayBufferLike> (pode incluir SharedArrayBuffer), que o TS não aceita
  // direto como BlobPart — copiamos para um ArrayBuffer isolado antes de passar para o Blob.
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `diagnostico-inss-obra-${slugify(data.nome) || 'simulacao'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
