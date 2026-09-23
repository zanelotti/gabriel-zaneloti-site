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
 * ============================================================================
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'node:fs';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const WHITE = rgb(1, 1, 1);
const NAVY_950 = rgb(0.0392, 0.0588, 0.1569);
const NAVY_900 = rgb(0.0588, 0.0863, 0.2196);
const NAVY_500 = rgb(0.2275, 0.2902, 0.5608);
const NAVY_400 = rgb(0.349, 0.4157, 0.6588);
const NAVY_300 = rgb(0.5176, 0.5765, 0.7765);
const NAVY_100 = rgb(0.8392, 0.8588, 0.9255);
const NAVY_50 = rgb(0.9333, 0.9412, 0.9686);
const NAVY_HEADER_SUBTEXT = rgb(0.7333, 0.7608, 0.851);
const ACCENT_700 = rgb(0.2941, 0.4157, 0.102);
const ACCENT_500 = rgb(0.4863, 0.6902, 0.1647);
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
    titulo: 'Não guardar as notas fiscais de pré-moldado e concreto usinado',
    texto:
      'Notas fiscais de aquisição/instalação de material pré-moldado ou pré-fabricado podem reduzir em até 70% a base de cálculo daquela área da obra — e o uso de concreto, argamassa ou massa asfáltica usinada gera um crédito automático sobre o custo da obra. Sem as notas guardadas, esses créditos simplesmente não podem ser aproveitados na aferição.',
  },
  {
    numero: '02',
    titulo: 'Deixar passar o prazo sem reunir provas da época da obra',
    texto:
      'A Receita Federal perde o direito de cobrar débitos 5 anos após o exercício seguinte ao fato gerador (decadência). Habite-se, alvará, IPTU histórico, contas de consumo, declaração de IR e laudos técnicos com ART/RRT são provas aceitas da época da construção — sem elas, competências que já deveriam estar decadentes acabam sendo cobradas normalmente.',
  },
  {
    numero: '03',
    titulo: 'Declarar errado (ou esquecer) as áreas complementares',
    texto:
      'Piscina, quadra, churrasqueira, varanda, garagem fora da projeção do corpo principal e áreas semelhantes têm redutores próprios: apenas 50% da área é considerada se for coberta, e 25% se for descoberta. Muitas obras acabam com essas áreas lançadas como se fossem área principal, pagando muito mais INSS do que deveriam.',
  },
  {
    numero: '04',
    titulo: 'Interromper a entrega da DCTFWeb durante a execução da obra',
    texto:
      'Para pessoa física, entregar a DCTFWeb de forma ininterrupta do início ao fim da obra — combinado com um volume suficiente de créditos — pode acionar o chamado "Fator de Ajuste", que é capaz de zerar todos os débitos presumidos da obra (art. 33 da IN RFB nº 2.021/2021). Uma única lacuna na entrega já compromete esse benefício.',
  },
  {
    numero: '05',
    titulo: 'Confundir contrato de empreitada total com contrato de administração',
    texto:
      'Se você contratou uma construtora, o tipo de contrato importa: o CNO é sempre da obra, não existe um "CNO da construtora". Em contrato de empreitada total, a responsabilidade pelas obrigações é da empresa; em contrato por administração, ela volta para você, dono da obra. Não identificar qual dos dois regimes está em vigor pode gerar cobranças e surpresas que poderiam ter sido evitadas.',
  },
];

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
  // Página 2 — Introdução
  // ---------------------------------------------------------------------
  const intro = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  intro.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: ACCENT_400 });

  let y = PAGE_HEIGHT - 80;
  intro.drawText('Antes de começar', { x: MARGIN, y, size: 20, font: fontBold, color: NAVY_900 });
  y -= 30;

  const introParas = [
    'O INSS de obra de construção civil é apurado com base nas características da construção (área, tipo construtivo, categoria, destinação) e na documentação apresentada — e a legislação prevê uma série de reduções legais para quem consegue comprovar corretamente essas características.',
    'Na prática, a maioria das obras acaba pagando mais do que precisaria, não por má-fé, mas por não conhecer os detalhes técnicos da Instrução Normativa RFB nº 2.021/2021 e do Manual do SERO (Serviço Eletrônico para Aferição de Obras).',
    'Este guia reúne 5 dos erros mais comuns que eu encontro ao analisar obras — todos com base na legislação, sem enrolação.',
  ];
  introParas.forEach((para) => {
    const lines = wrapText(para, font, 11.5, CONTENT_WIDTH);
    lines.forEach((line) => {
      intro.drawText(line, { x: MARGIN, y, size: 11.5, font, color: rgb(0.28, 0.32, 0.42) });
      y -= 17;
    });
    y -= 10;
  });

  y -= 6;
  intro.drawRectangle({ x: MARGIN, y: y - 68, width: CONTENT_WIDTH, height: 68, color: ACCENT_50, borderColor: rgb(0.8, 0.898, 0.6), borderWidth: 1 });
  intro.drawText('IMPORTANTE', { x: MARGIN + 16, y: y - 24, size: 9, font: fontBold, color: ACCENT_700 });
  const disclaimerLines = wrapText(
    'Este material é educativo e não substitui uma análise técnica da documentação da sua obra. Cada caso tem particularidades que só uma avaliação individual identifica.',
    font,
    10,
    CONTENT_WIDTH - 32
  );
  let discY = y - 40;
  disclaimerLines.forEach((line) => {
    intro.drawText(line, { x: MARGIN + 16, y: discY, size: 10, font, color: rgb(0.28, 0.32, 0.42) });
    discY -= 14;
  });

  // ---------------------------------------------------------------------
  // Páginas 3+ — Os 5 erros (uma por página)
  // ---------------------------------------------------------------------
  ERROS.forEach((erro) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: ACCENT_400 });

    let py = PAGE_HEIGHT - 100;
    page.drawText(erro.numero, { x: MARGIN, y: py, size: 52, font: fontBold, color: NAVY_100 });

    const tituloLines = wrapText(erro.titulo, fontBold, 19, CONTENT_WIDTH - 90);
    let tituloY = PAGE_HEIGHT - 78;
    tituloLines.forEach((line) => {
      page.drawText(line, { x: MARGIN + 90, y: tituloY, size: 19, font: fontBold, color: NAVY_900 });
      tituloY -= 25;
    });

    py = Math.min(py - 20, tituloY - 20);
    page.drawLine({
      start: { x: MARGIN, y: py + 10 },
      end: { x: PAGE_WIDTH - MARGIN, y: py + 10 },
      thickness: 1,
      color: NAVY_100,
    });

    let textY = py - 20;
    const textLines = wrapText(erro.texto, font, 12.5, CONTENT_WIDTH);
    textLines.forEach((line) => {
      page.drawText(line, { x: MARGIN, y: textY, size: 12.5, font, color: rgb(0.24, 0.28, 0.38) });
      textY -= 19;
    });

    page.drawText(`${erro.numero.replace('0', '')} / 05`, {
      x: PAGE_WIDTH - MARGIN - 30,
      y: 36,
      size: 9,
      font,
      color: NAVY_300,
    });
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
