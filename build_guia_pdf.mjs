/**
 * ============================================================================
 *  SCRIPT DE GERAÇÃO DO GUIA GRATUITO (lead magnet) — roda uma vez, offline
 * ============================================================================
 * Gera o PDF estático `public/guia-gratuito-inss-obra.pdf`, servido pela
 * seção GuiaGratuito.tsx. Não faz parte do build do site nem roda em tempo de
 * execução — é só a "fonte" do conteúdo do PDF, para poder editar o texto e
 * regenerar o arquivo sempre que quiser.
 *
 * Como rodar (na raiz do projeto, com as dependências já instaladas):
 *   node build_guia_pdf.mjs
 *
 * Depois de rodar, o arquivo em `public/guia-gratuito-inss-obra.pdf` é
 * sobrescrito — é só commitar normalmente.
 *
 * Layout: capa + CTA em páginas de destaque (fundo navy); entre elas, um
 * fluxo contínuo (intro + os 5 tópicos) que quebra de página só quando o
 * conteúdo não cabe mais — em vez de um tópico fixo por página — para não
 * sobrar espaço em branco desnecessário.
 * ============================================================================
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'node:fs';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_TOP = PAGE_HEIGHT - 70;
const CONTENT_BOTTOM = 60;

const WHITE = rgb(1, 1, 1);
const NAVY_950 = rgb(0.0392, 0.0588, 0.1569);
const NAVY_900 = rgb(0.0588, 0.0863, 0.2196);
const NAVY_700 = rgb(0.24, 0.28, 0.38);
const NAVY_400 = rgb(0.349, 0.4157, 0.6588);
const NAVY_300 = rgb(0.5176, 0.5765, 0.7765);
const NAVY_100 = rgb(0.8392, 0.8588, 0.9255);
const NAVY_HEADER_SUBTEXT = rgb(0.7333, 0.7608, 0.851);
const ACCENT_700 = rgb(0.2941, 0.4157, 0.102);
const ACCENT_400 = rgb(0.5765, 0.7882, 0.2275);
const ACCENT_50 = rgb(0.9569, 0.9765, 0.9137);
const AMBER_500 = rgb(0.9686, 0.5725, 0.0588);

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
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

const ERROS = [
  {
    numero: '01',
    titulo: 'Não reunir comprovantes de pagamento da mão de obra',
    texto:
      'Anote quem trabalhou na obra — pedreiro, servente, ajudante, eletricista — e peça que assinem um recibo simples a cada pagamento, com nome, função, valor e data. Esse registro ajuda a comprovar a mão de obra efetivamente empregada na construção, um dos elementos considerados na aferição.',
  },
  {
    numero: '02',
    titulo: 'Não registrar a paralisação da obra no SERO',
    texto:
      'Se a obra for interrompida por qualquer motivo, é preciso registrar essa paralisação também no SERO — não só fisicamente. Sem esse registro, os meses parados continuam exigindo a entrega normal da DCTFWeb, e a falta dela gera multa e juros mesmo sem nenhuma atividade na obra.',
  },
  {
    numero: '03',
    titulo: 'Declarar errado (ou esquecer) as áreas complementares',
    texto:
      'Piscina, quadra, garagem fora da projeção do corpo principal e outras áreas complementares têm redutores próprios na base de cálculo, diferentes da área principal da construção. Muitas obras acabam lançando essas áreas como se fossem área principal, pagando mais INSS do que deveriam.',
  },
  {
    numero: '04',
    titulo: 'Interromper a entrega da DCTFWeb durante a execução da obra',
    texto:
      'Para pessoa física, entregar a DCTFWeb de forma ininterrupta do início ao fim da obra — combinado com um volume suficiente de créditos — pode acionar o chamado "Fator de Ajuste", capaz de reduzir em até 70% os débitos presumidos da obra (art. 33 da IN RFB nº 2.021/2021). Uma única lacuna na entrega já compromete esse benefício.',
  },
  {
    numero: '05',
    titulo: 'Confundir contrato de empreitada total com contrato de administração',
    texto:
      'Se você contratou uma construtora, o tipo de contrato importa: o CNO é sempre da obra, não existe um "CNO da construtora". Em contrato de empreitada total, a responsabilidade pelas obrigações é da empresa; em contrato por administração, ela volta para você, dono da obra. Não identificar qual dos dois regimes está em vigor pode gerar cobranças e surpresas que poderiam ter sido evitadas.',
  },
];

/** Cursor simples de layout: escreve em sequência e quebra de página quando o conteúdo não cabe mais. */
class Cursor {
  constructor(doc) {
    this.doc = doc;
    this.page = null;
    this.y = 0;
    this.pageIndexInFlow = 0;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: ACCENT_400 });
    this.y = CONTENT_TOP;
    this.pageIndexInFlow += 1;
  }

  /** Garante que ainda cabem `height` pontos antes do rodapé; se não, quebra de página. */
  ensureSpace(height) {
    if (this.y - height < CONTENT_BOTTOM) this.newPage();
  }

  paragraph(text, { size = 11.5, font, color = NAVY_700, lineGap = 16.5, gapAfter = 12 } = {}) {
    const lines = wrapText(text, font, size, CONTENT_WIDTH);
    this.ensureSpace(lines.length * lineGap);
    lines.forEach((line) => {
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color });
      this.y -= lineGap;
    });
    this.y -= gapAfter;
  }

  spacer(height) {
    this.y -= height;
  }
}

async function run() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const photoBytes = readFileSync('./public/gabriel-zaneloti.jpg');
  const photo = await doc.embedJpg(photoBytes);

  // ---------------------------------------------------------------------
  // Página 1 — Capa
  // ---------------------------------------------------------------------
  const cover = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: NAVY_950 });
  cover.drawRectangle({ x: 0, y: PAGE_HEIGHT - 8, width: PAGE_WIDTH, height: 8, color: ACCENT_400 });

  cover.drawText('GUIA GRATUITO', {
    x: MARGIN,
    y: PAGE_HEIGHT - 140,
    size: 12,
    font: fontBold,
    color: ACCENT_400,
  });

  const titleLines = wrapText('5 erros que fazem pessoas físicas pagarem mais INSS de obra', fontBold, 28, CONTENT_WIDTH);
  let coverY = PAGE_HEIGHT - 175;
  titleLines.forEach((line) => {
    cover.drawText(line, { x: MARGIN, y: coverY, size: 28, font: fontBold, color: WHITE });
    coverY -= 34;
  });

  coverY -= 10;
  const subtitleLines = wrapText(
    'E como identificar, com base na legislação, se a sua obra pode estar pagando mais INSS do que deveria.',
    font,
    13,
    CONTENT_WIDTH - 40
  );
  subtitleLines.forEach((line) => {
    cover.drawText(line, { x: MARGIN, y: coverY, size: 13, font, color: NAVY_HEADER_SUBTEXT });
    coverY -= 19;
  });

  // Rodapé da capa: foto + nome
  const photoSize = 64;
  const photoX = MARGIN;
  const photoY = 90;
  cover.drawRectangle({
    x: photoX - 3,
    y: photoY - 3,
    width: photoSize + 6,
    height: photoSize + 6,
    color: ACCENT_400,
  });
  const photoDims = photo.scale(1);
  const photoRatio = photoDims.width / photoDims.height;
  let drawW = photoSize;
  let drawH = photoSize;
  if (photoRatio > 1) drawH = photoSize / photoRatio;
  else drawW = photoSize * photoRatio;
  cover.drawImage(photo, {
    x: photoX + (photoSize - drawW) / 2,
    y: photoY + (photoSize - drawH) / 2,
    width: drawW,
    height: drawH,
  });
  cover.drawText('Gabriel Zaneloti', {
    x: photoX + photoSize + 16,
    y: photoY + 36,
    size: 14,
    font: fontBold,
    color: WHITE,
  });
  cover.drawText('Planejamento Tributário · INSS de Obras', {
    x: photoX + photoSize + 16,
    y: photoY + 18,
    size: 10,
    font,
    color: NAVY_HEADER_SUBTEXT,
  });

  // ---------------------------------------------------------------------
  // Páginas 2+ — fluxo contínuo: introdução + os 5 tópicos, um atrás do
  // outro, quebrando de página só quando o conteúdo não cabe mais.
  // ---------------------------------------------------------------------
  const cursor = new Cursor(doc);

  cursor.page.drawText('Antes de começar', { x: MARGIN, y: cursor.y, size: 20, font: fontBold, color: NAVY_900 });
  cursor.y -= 30;

  cursor.paragraph(
    'O INSS de obra de construção civil é apurado com base nas características da construção (área, tipo construtivo, categoria, destinação) e na documentação apresentada — e a legislação prevê uma série de reduções legais para quem consegue comprovar corretamente essas características.',
    { font }
  );
  cursor.paragraph(
    'Na prática, a maioria das obras acaba pagando mais do que precisaria, não por má-fé, mas por não conhecer os detalhes técnicos da Instrução Normativa RFB nº 2.021/2021 e do Manual do SERO (Serviço Eletrônico para Aferição de Obras).',
    { font }
  );
  cursor.paragraph(
    'Este guia reúne 5 dos erros mais comuns que eu encontro ao analisar obras de pessoa física — todos com base na legislação, sem enrolação.',
    { font, gapAfter: 4 }
  );

  // Caixa "importante"
  const disclaimerLines = wrapText(
    'Este material é educativo e não substitui uma análise técnica da documentação da sua obra. Cada caso tem particularidades que só uma avaliação individual identifica.',
    font,
    10,
    CONTENT_WIDTH - 32
  );
  const disclaimerHeight = 24 + disclaimerLines.length * 14;
  cursor.ensureSpace(disclaimerHeight + 16);
  cursor.page.drawRectangle({
    x: MARGIN,
    y: cursor.y - disclaimerHeight,
    width: CONTENT_WIDTH,
    height: disclaimerHeight,
    color: ACCENT_50,
    borderColor: rgb(0.8, 0.898, 0.6),
    borderWidth: 1,
  });
  cursor.page.drawText('IMPORTANTE', { x: MARGIN + 16, y: cursor.y - 20, size: 9, font: fontBold, color: ACCENT_700 });
  let discY = cursor.y - 36;
  disclaimerLines.forEach((line) => {
    cursor.page.drawText(line, { x: MARGIN + 16, y: discY, size: 10, font, color: NAVY_700 });
    discY -= 14;
  });
  cursor.y -= disclaimerHeight + 34;

  // Os 5 tópicos, em fluxo contínuo (badge numerado + título na mesma linha,
  // parágrafo logo abaixo, linha divisória fina entre um tópico e o outro).
  // Força uma quebra de página só antes do 3º tópico — sem isso, o encaixe
  // "guloso" (cabe o que couber) deixaria os 2 últimos tópicos sozinhos numa
  // página quase vazia; assim, a página da introdução fica com 2 tópicos e a
  // seguinte com os outros 3, bem mais equilibrado.
  ERROS.forEach((erro, index) => {
    if (index === 2) cursor.newPage();

    const badgeSize = 26;
    const tituloSize = 14;
    const tituloLines = wrapText(erro.titulo, fontBold, tituloSize, CONTENT_WIDTH - badgeSize - 16);
    const headerHeight = Math.max(badgeSize, tituloLines.length * 18);
    const textoLines = wrapText(erro.texto, font, 11, CONTENT_WIDTH - badgeSize - 16);
    const blockHeight = headerHeight + 10 + textoLines.length * 16 + 26;

    cursor.ensureSpace(blockHeight);

    const blockTop = cursor.y;
    cursor.page.drawEllipse({
      x: MARGIN + badgeSize / 2,
      y: blockTop - badgeSize / 2 + 3,
      xScale: badgeSize / 2,
      yScale: badgeSize / 2,
      color: ACCENT_400,
    });
    cursor.page.drawText(erro.numero, {
      x: MARGIN + (erro.numero.length > 1 ? 5 : 9),
      y: blockTop - badgeSize / 2 - 3,
      size: 11,
      font: fontBold,
      color: NAVY_950,
    });

    let tituloY = blockTop - 3;
    tituloLines.forEach((line) => {
      cursor.page.drawText(line, { x: MARGIN + badgeSize + 16, y: tituloY, size: tituloSize, font: fontBold, color: NAVY_900 });
      tituloY -= 18;
    });

    let textY = blockTop - headerHeight - 10;
    textoLines.forEach((line) => {
      cursor.page.drawText(line, { x: MARGIN + badgeSize + 16, y: textY, size: 11, font, color: NAVY_700 });
      textY -= 16;
    });

    cursor.y = textY - 10;

    if (index < ERROS.length - 1) {
      cursor.page.drawLine({
        start: { x: MARGIN, y: cursor.y },
        end: { x: PAGE_WIDTH - MARGIN, y: cursor.y },
        thickness: 1,
        color: NAVY_100,
      });
      cursor.y -= 20;
    }
  });

  // ---------------------------------------------------------------------
  // Última página — CTA
  // ---------------------------------------------------------------------
  const cta = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  cta.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: NAVY_950 });
  cta.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: ACCENT_400 });

  let ctaY = PAGE_HEIGHT - 220;
  const ctaTitleLines = wrapText('Quer saber se a sua obra está nessa lista?', fontBold, 26, CONTENT_WIDTH - 20);
  ctaTitleLines.forEach((line) => {
    cta.drawText(line, { x: MARGIN, y: ctaY, size: 26, font: fontBold, color: WHITE });
    ctaY -= 32;
  });

  ctaY -= 8;
  const ctaBodyLines = wrapText(
    'Faça a simulação gratuita no site e receba uma estimativa inicial do potencial de economia da sua obra, com base nos seus próprios dados.',
    font,
    12.5,
    CONTENT_WIDTH - 60
  );
  ctaBodyLines.forEach((line) => {
    cta.drawText(line, { x: MARGIN, y: ctaY, size: 12.5, font, color: NAVY_HEADER_SUBTEXT });
    ctaY -= 18;
  });

  ctaY -= 24;
  const btnHeight = 40;
  cta.drawRectangle({ x: MARGIN, y: ctaY - btnHeight, width: 260, height: btnHeight, color: AMBER_500 });
  cta.drawText('gabrielzaneloti.com.br', {
    x: MARGIN + 24,
    y: ctaY - btnHeight / 2 - 5,
    size: 13,
    font: fontBold,
    color: NAVY_950,
  });

  ctaY -= btnHeight + 40;
  cta.drawText('Ou fale diretamente comigo:', { x: MARGIN, y: ctaY, size: 11, font, color: NAVY_HEADER_SUBTEXT });
  ctaY -= 20;
  cta.drawText('Gabriel Zaneloti — Planejamento Tributário · INSS de Obras', {
    x: MARGIN,
    y: ctaY,
    size: 13,
    font: fontBold,
    color: WHITE,
  });
  ctaY -= 18;
  cta.drawText('WhatsApp: +55 21 98521-3949', { x: MARGIN, y: ctaY, size: 11, font, color: ACCENT_400 });

  const bytes = await doc.save();
  writeFileSync('./public/guia-gratuito-inss-obra.pdf', bytes);
  console.log('Guia PDF gerado com sucesso, bytes:', bytes.length, 'páginas:', doc.getPageCount());
}

run().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});
