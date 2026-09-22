/**
 * ============================================================================
 *  PDF PÚBLICO DE DIAGNÓSTICO — gerado no navegador (client-side)
 * ============================================================================
 * Monta um PDF de 1 página com o resumo da simulação que o próprio lead
 * preencheu (mesmos dados exibidos no ResultCard), para ele baixar e guardar.
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
import type { PDFFont, PDFPage } from 'pdf-lib';
import type { CalculatorData, INSSResult } from '@/types/calculator';
import { formatArea, formatCurrency, formatDateBR, formatPercent } from '@/utils/formatters';
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
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY_900 = rgb(0.0588, 0.0863, 0.2196);
const NAVY_500 = rgb(0.2275, 0.2902, 0.5608);
const NAVY_300 = rgb(0.5176, 0.5765, 0.7765);
const ACCENT_700 = rgb(0.2941, 0.4157, 0.102);

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

/** Cursor simples de desenho — controla posição vertical e cria novas páginas quando o conteúdo não cabe. */
class PdfCursor {
  page: PDFPage;
  y: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly fontBold: PDFFont
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  spacer(height: number) {
    this.y -= height;
  }

  line(color = NAVY_300) {
    this.ensureSpace(10);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
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

  /** Par label/valor lado a lado (para o resumo dos dados da obra). */
  field(label: string, value: string) {
    const size = 9;
    this.ensureSpace(size * 2 + 6);
    this.page.drawText(label.toUpperCase(), { x: MARGIN, y: this.y - size, size: 7.5, font: this.font, color: NAVY_300 });
    this.page.drawText(value, {
      x: MARGIN,
      y: this.y - size - 12,
      size,
      font: this.fontBold,
      color: NAVY_900,
    });
    this.y -= size * 2 + 10;
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

/**
 * Gera os bytes do PDF de diagnóstico público. Só lê os campos "seguros" de
 * `result` (nunca `result.detalheInterno`) — ver aviso no topo do arquivo.
 */
export async function generateLeadPdfBytes(data: CalculatorData, result: INSSResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cursor = new PdfCursor(doc, font, fontBold);

  cursor.text('Diagnóstico Inicial de INSS de Obra', { size: 17, bold: true });
  cursor.text('Gabriel Zaneloti — Planejamento Tributário', { size: 10, color: NAVY_500, gap: 2 });
  cursor.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} a partir da simulação preenchida no site.`,
    { size: 8.5, color: NAVY_300, gap: 10 }
  );
  cursor.line();
  cursor.spacer(6);

  cursor.text('Dados da obra informados', { size: 11, bold: true, gap: 10 });
  const fields = buildDataFields(data);
  for (let i = 0; i < fields.length; i += 2) {
    const [label1, value1] = fields[i];
    const [label2, value2] = fields[i + 1] ?? [null, null];
    cursor.ensureSpace(30);
    const rowY = cursor.y;
    cursor.page.drawText(label1.toUpperCase(), { x: MARGIN, y: rowY - 7.5, size: 7.5, font, color: NAVY_300 });
    cursor.page.drawText(value1, { x: MARGIN, y: rowY - 19.5, size: 9, font: fontBold, color: NAVY_900 });
    if (label2 && value2) {
      const colX = MARGIN + CONTENT_WIDTH / 2;
      cursor.page.drawText(label2.toUpperCase(), { x: colX, y: rowY - 7.5, size: 7.5, font, color: NAVY_300 });
      cursor.page.drawText(value2, { x: colX, y: rowY - 19.5, size: 9, font: fontBold, color: NAVY_900 });
    }
    cursor.y -= 28;
  }

  if (data.observacoes) {
    cursor.spacer(4);
    cursor.text('Observações', { size: 9, bold: true, gap: 4 });
    cursor.paragraph(data.observacoes, { gap: 3 });
  }

  cursor.spacer(6);
  cursor.line();
  cursor.spacer(6);

  // Mesma lógica de ramificação usada em ResultCard.tsx — mantenha sincronizado se ela mudar lá.
  const fatorAjusteNaoAplicavel = data.responsavel === 'PJ';
  const exigeAnaliseManual = !fatorAjusteNaoAplicavel && result.regimeApuracao === 'gfip_anterior_2021';

  cursor.text('Resultado da simulação', { size: 11, bold: true, gap: 10 });

  if (fatorAjusteNaoAplicavel) {
    cursor.field('INSS pela aferição indireta', formatCurrency(result.inssEstimado));
    cursor.spacer(4);
    cursor.paragraph(
      'O Fator de Ajuste (a redução legal aplicada nas obras de Pessoa Física) não se aplica a obras de Pessoa ' +
        'Jurídica. Para PJ, a economia vem de outras frentes específicas da empresa — fale com o Gabriel para uma ' +
        'análise personalizada.',
      { gap: 3 }
    );
  } else if (exigeAnaliseManual) {
    cursor.field('INSS devido estimado (sem redução)', formatCurrency(result.inssEstimado));
    cursor.spacer(4);
    cursor.paragraph(
      'Obra iniciada antes de outubro de 2021 — período apurado pelo GFIP, com regras próprias que exigem uma ' +
        'análise manual detalhada para calcular a redução aplicável.',
      { gap: 3 }
    );
  } else {
    cursor.ensureSpace(60);
    const rowY = cursor.y;
    const colWidth = CONTENT_WIDTH / 2;
    const cells: Array<[string, string, boolean]> = [
      ['INSS estimado antes da análise', formatCurrency(result.inssEstimado), false],
      ['Valor estimado após redução', formatCurrency(result.valorAposReducao), false],
      ['Redução estimada', formatPercent(result.percentualReducao), true],
      ['Economia estimada', formatCurrency(result.economiaEstimada), true],
    ];
    cells.forEach(([label, value, highlight], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = MARGIN + col * colWidth;
      const y = rowY - row * 34;
      cursor.page.drawText(label.toUpperCase(), { x, y: y - 7.5, size: 7.5, font, color: NAVY_300 });
      cursor.page.drawText(value, {
        x,
        y: y - 20.5,
        size: 12,
        font: fontBold,
        color: highlight ? ACCENT_700 : NAVY_900,
      });
    });
    cursor.y = rowY - 68 - 10;
  }

  cursor.spacer(10);
  cursor.line();
  cursor.spacer(8);
  cursor.paragraph(
    'Este resultado é uma estimativa inicial calculada com base nos dados informados e não substitui uma análise ' +
      'técnica e tributária completa da documentação da obra. Os honorários (cobrados apenas sobre a economia ' +
      'efetivamente comprovada) são apresentados em uma proposta específica, após conversa direta com o Gabriel.',
    { size: 8, color: NAVY_300, gap: 3 }
  );
  cursor.spacer(4);
  cursor.text('Fale com o Gabriel no WhatsApp para confirmar essa economia com uma análise completa.', {
    size: 9,
    bold: true,
    color: NAVY_500,
    gap: 2,
  });

  return doc.save();
}

/** Gera o PDF e dispara o download no navegador. */
export async function downloadLeadPdf(data: CalculatorData, result: INSSResult): Promise<void> {
  const bytes = await generateLeadPdfBytes(data, result);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `diagnostico-inss-obra-${slugify(data.nome) || 'simulacao'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
