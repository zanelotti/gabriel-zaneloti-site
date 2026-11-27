/**
 * PDF da simulação que a Lia manda ao cliente pelo WhatsApp, logo depois dos números.
 *
 * Mesmo visual do PDF do site (src/services/pdfReport.ts): cabeçalho azul-marinho com a foto do Gabriel,
 * dados da obra, cartões com o resultado e barras de comparação.
 *
 * IMPORTANTE: é um documento do CLIENTE. Nunca entra honorário, percentual de honorário, economia líquida
 * nem o detalhamento mês a mês (isso fica só no e-mail interno do Gabriel).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';
import { obraEmAndamento } from './util.js';

/** Gravada no histórico da conversa quando a Lia manda o PDF. */
export const MARCA_PDF = '[arquivo enviado: PDF da simulação]';

const FOTO = fileURLToPath(new URL('../assets/gabriel-zaneloti.jpg', import.meta.url));
const WHATSAPP_DISPLAY = '+55 21 98521-3949';
/** Link do rodapé: com UTM, para o CRM saber que a visita veio do PDF da simulação. */
export const LINK_SITE_PDF = 'https://www.gabrielzaneloti.com.br/?utm_source=pdf&utm_medium=whatsapp&utm_campaign=simulacao';

const W = 595.28; // A4
const H = 841.89;
const M = 40;
const CW = W - M * 2;
const HEADER = 122;
const FOOTER = 30;

const WHITE = rgb(1, 1, 1);
const NAVY_950 = rgb(0.0392, 0.0588, 0.1569);
const NAVY_900 = rgb(0.0588, 0.0863, 0.2196);
const NAVY_500 = rgb(0.2275, 0.2902, 0.5608);
const NAVY_300 = rgb(0.5176, 0.5765, 0.7765);
const NAVY_100 = rgb(0.8392, 0.8588, 0.9255);
const NAVY_50 = rgb(0.9333, 0.9412, 0.9686);
const NAVY_SUB = rgb(0.7333, 0.7608, 0.851);
const ACCENT_700 = rgb(0.2941, 0.4157, 0.102);
const ACCENT_400 = rgb(0.5765, 0.7882, 0.2275);
const ACCENT_200 = rgb(0.8, 0.898, 0.6);
const ACCENT_50 = rgb(0.9569, 0.9765, 0.9137);
const AMBER_500 = rgb(0.9686, 0.5725, 0.0588);
const AMBER_50 = rgb(1, 0.9725, 0.9255);

const ROTULO_DESTINACAO = {
  residencial_unifamiliar: 'Casa (residencial unifamiliar)',
  multifamiliar: 'Prédio de apartamentos',
  comercial_salas_lojas: 'Comercial (salas e lojas)',
  galpao_industrial: 'Galpão industrial',
  conjunto_habitacional: 'Conjunto habitacional',
  edificio_garagem: 'Edifício-garagem',
};
const ROTULO_CATEGORIA = { obra_nova: 'Obra nova', acrescimo: 'Acréscimo', reforma: 'Reforma', demolicao: 'Demolição' };
const ROTULO_TIPO = { alvenaria: 'Alvenaria', madeira: 'Madeira', mista: 'Mista' };

/** Só caracteres que a fonte padrão do PDF (WinAnsi) sabe desenhar. */
function limpo(t) {
  return String(t ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e¡-ÿ•·²]/g, '');
}
const reais = (v) => limpo(Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }));
const area = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
const mesAno = (iso) => (/^\d{4}-\d{2}/.test(String(iso || '')) ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

function quebrar(texto, fonte, tam, largura) {
  const palavras = limpo(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(teste, tam) > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/**
 * Converte o lead do site (linha da tabela `leads`) para o formato usado aqui.
 * Devolve null se o lead não tiver números para mostrar.
 */
export function simulacaoDoLead(lead) {
  if (!lead || lead.responsavel === 'PJ') return null;
  const inss = Number(lead.inss_estimado);
  if (!(inss > 0)) return null;
  const emAndamento = obraEmAndamento(lead);
  const economia = Number(lead.economia_estimada);
  return {
    dados: {
      estado: lead.estado,
      destinacao: lead.destinacao,
      tipoObra: lead.tipo_obra,
      categoria: lead.categoria,
      areaPrincipal: Number(lead.area_principal) || 0,
      areaComplementar: Number(lead.area_piscina) || 0,
      dataInicio: lead.data_inicio,
      dataFim: lead.data_fim,
    },
    r: {
      inssEstimado: inss,
      valorAposReducao: Number(lead.valor_apos_reducao) || 0,
      economiaEstimada: economia > 0 ? economia : 0,
      percentualReducao: Number(lead.percentual_reducao) || 0,
      regime: economia > 0 ? 'esocial' : 'gfip_anterior_2021',
      emAndamento,
      // O site não guarda o valor da parcela: o PDF só diz "até 60x" (o mesmo que a Lia diz na conversa).
      parcelamento: emAndamento ? null : { aplicavel: true, numeroParcelas: 60 },
    },
  };
}

/** "maria da SILVA" -> "Maria da Silva" */
export function nomeBonito(nome) {
  return String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && /^(da|de|do|das|dos|e)$/i.test(p) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(' ');
}

/** Nome do arquivo que aparece no WhatsApp. */
export function nomeArquivoPdf(nome) {
  const slug = String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `Simulacao INSS da obra${slug ? ` - ${slug}` : ''}.pdf`;
}

/**
 * Gera o PDF (Buffer). `dados` e `r` no formato de simulacao.js (normalizarEntrada / simular),
 * ou o que simulacaoDoLead devolve.
 */
export async function gerarPdfSimulacao({ nome = '', dados, r, hoje = new Date() }) {
  const doc = await PDFDocument.create();
  doc.setTitle('Simulação de INSS da obra');
  doc.setAuthor('Gabriel Zaneloti');
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  let foto = null;
  try {
    foto = await doc.embedJpg(readFileSync(FOTO));
  } catch {
    foto = null; // sem a foto o PDF sai do mesmo jeito
  }
  const pg = doc.addPage([W, H]);
  const txt = (s, x, y, size, font = f, color = NAVY_900) => pg.drawText(limpo(s), { x, y, size, font, color });

  // ---- Cabeçalho
  pg.drawRectangle({ x: 0, y: H - HEADER, width: W, height: HEADER, color: NAVY_950 });
  pg.drawRectangle({ x: 0, y: H - HEADER - 3, width: W, height: 3, color: ACCENT_400 });
  txt('GABRIEL ZANELOTI', M, H - 44, 21, fb, WHITE);
  txt('PLANEJAMENTO TRIBUTÁRIO · INSS DE OBRAS', M, H - 60, 8.5, fb, ACCENT_400);
  txt('Simulação de INSS da obra', M, H - 86, 13, f, WHITE);
  nome = nomeBonito(nome);
  const para = nome ? `Preparada para ${nome} em ${hoje.toLocaleDateString('pt-BR')}.` : `Preparada em ${hoje.toLocaleDateString('pt-BR')}.`;
  txt(para, M, H - 102, 8, f, NAVY_SUB);
  if (foto) {
    const s = 72;
    const x = W - M - s;
    const y = H - HEADER / 2 - s / 2;
    pg.drawRectangle({ x: x - 4, y: y - 4, width: s + 8, height: s + 8, color: ACCENT_400 });
    const d = foto.scale(1);
    const k = s / Math.max(d.width, d.height);
    pg.drawImage(foto, { x: x + (s - d.width * k) / 2, y: y + (s - d.height * k) / 2, width: d.width * k, height: d.height * k });
  }

  let y = H - HEADER - 24;

  // ---- Dados da obra
  txt('Dados da obra', M, y - 12, 12, fb);
  y -= 26;
  const campos = [
    ['Estado', dados.estado || '-'],
    ['Uso da obra', ROTULO_DESTINACAO[dados.destinacao] || '-'],
    ['Tipo construtivo', ROTULO_TIPO[dados.tipoObra] || '-'],
    ['Categoria', ROTULO_CATEGORIA[dados.categoria] || '-'],
    ['Área principal', dados.areaPrincipal ? area(dados.areaPrincipal) : '-'],
    ['Área complementar', dados.areaComplementar ? area(dados.areaComplementar) : 'Não tem'],
    ['Início da obra', mesAno(dados.dataInicio) || '-'],
    ['Término da obra', dados.dataFim ? mesAno(dados.dataFim) : 'Em andamento'],
  ];
  const linhas = Math.ceil(campos.length / 2);
  const alt = 16 + linhas * 25 + 6;
  pg.drawRectangle({ x: M, y: y - alt, width: CW, height: alt, color: NAVY_50, borderColor: NAVY_100, borderWidth: 1 });
  campos.forEach(([rot, val], i) => {
    const x = M + 14 + (i % 2) * (CW / 2);
    const ry = y - 14 - Math.floor(i / 2) * 25;
    txt(rot.toUpperCase(), x, ry - 7.5, 7.5, f, NAVY_300);
    txt(val, x, ry - 19.5, 9.5, fb, NAVY_900);
  });
  y -= alt + 18;

  // ---- Resultado
  txt('Resultado da simulação', M, y - 12, 12, fb);
  y -= 24;

  const temEconomia = r.regime !== 'gfip_anterior_2021' && r.economiaEstimada > 0;
  if (!temEconomia) {
    const antigaSemCobranca = r.regime === 'gfip_anterior_2021' && !(r.inssEstimado > 0);
    if (!antigaSemCobranca) {
      pg.drawRectangle({ x: M, y: y - 70, width: CW, height: 70, color: WHITE, borderColor: NAVY_100, borderWidth: 1 });
      txt('INSS SEM PLANEJAMENTO', M + 14, y - 24, 7.5, f, NAVY_300);
      txt(reais(r.inssEstimado), M + 14, y - 42, 18, fb, NAVY_900);
      y -= 84;
    }
    const expl = antigaSemCobranca
      ? 'Pelo prazo de 5 anos que a Receita tem para cobrar, essa obra pode já estar fora da cobrança. Isso se comprova com documentos da época da obra (habite-se, alvará, IPTU, contas de consumo).'
      : r.regime === 'gfip_anterior_2021'
        ? 'Como a obra começou antes de 2021, a redução vem do período (a Receita só cobra os últimos 5 anos) e dos documentos da época.'
        : 'Com esses dados, o Fator de Ajuste sozinho não mostra economia, mas há outras frentes (notas fiscais, mão de obra comprovada, tempo da obra).';
    const ls = quebrar(expl, f, 9, CW - 28);
    const ah = 22 + ls.length * 13;
    pg.drawRectangle({ x: M, y: y - ah, width: CW, height: ah, color: AMBER_50, borderColor: AMBER_500, borderWidth: 1 });
    ls.forEach((l, i) => txt(l, M + 14, y - 18 - i * 13, 9, f, NAVY_900));
    y -= ah + 18;
  } else {
    const gap = 8;
    const cw = (CW - gap) / 2;
    const ch = 56;
    const cartoes = [
      ['Sem planejamento (Receita)', reais(r.inssEstimado), false],
      ['Com o planejamento', reais(r.valorAposReducao), false],
      ['Economia estimada', reais(r.economiaEstimada), true],
      ['Redução', `${Math.round(Number(r.percentualReducao) || 0)}%`, true],
    ];
    cartoes.forEach(([rot, val, dest], i) => {
      const x = M + (i % 2) * (cw + gap);
      const top = y - Math.floor(i / 2) * (ch + gap);
      pg.drawRectangle({ x, y: top - ch, width: cw, height: ch, color: dest ? ACCENT_50 : WHITE, borderColor: dest ? ACCENT_200 : NAVY_100, borderWidth: 1 });
      txt(rot.toUpperCase(), x + 12, top - 18, 7, f, NAVY_300);
      txt(val, x + 12, top - 42, 16, fb, dest ? ACCENT_700 : NAVY_900);
    });
    y -= 2 * (ch + gap) + 6;

    // Barras
    const bh = 78;
    pg.drawRectangle({ x: M, y: y - bh, width: CW, height: bh, color: WHITE, borderColor: NAVY_100, borderWidth: 1 });
    const max = Math.max(r.inssEstimado, r.valorAposReducao, 1);
    let by = y - 14;
    [
      ['Sem planejamento', r.inssEstimado, NAVY_300],
      ['Com o planejamento', r.valorAposReducao, ACCENT_400],
    ].forEach(([rot, val, cor], i) => {
      const larg = CW - 28;
      const v = reais(val);
      txt(rot.toUpperCase(), M + 14, by - 7, 7.5, f, NAVY_300);
      txt(v, M + 14 + larg - fb.widthOfTextAtSize(v, 9), by - 7, 9, fb, NAVY_900);
      by -= 13;
      pg.drawRectangle({ x: M + 14, y: by - 10, width: larg, height: 10, color: NAVY_50 });
      pg.drawRectangle({ x: M + 14, y: by - 10, width: Math.max(10, (val / max) * larg), height: 10, color: cor });
      by -= 10;
      if (i === 0) by -= 10;
    });
    y -= bh + 12;

    const notas = [];
    if (r.parcelamento?.aplicavel) {
      notas.push(
        r.parcelamento.valorParcela
          ? `O saldo dos meses em atraso ainda pode ser parcelado em até ${r.parcelamento.numeroParcelas} vezes (parcelas de cerca de ${reais(r.parcelamento.valorParcela)}).`
          : `O valor a ser pago ainda pode ser parcelado em até ${r.parcelamento.numeroParcelas || 60} vezes.`
      );
    } else if (r.emAndamento) {
      notas.push('Como a obra está em andamento, o INSS dela é pago mês a mês, conforme a obra avança.');
    }
    notas.push('A redução segue a Instrução Normativa RFB nº 2.021/2021 (Fator de Ajuste).');
    for (const n of notas) {
      for (const l of quebrar(n, f, 8.5, CW)) {
        txt(l, M, y - 8.5, 8.5, f, NAVY_500);
        y -= 12;
      }
    }
    y -= 6;
  }

  // ---- Aviso
  pg.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: NAVY_100 });
  y -= 14;
  const aviso =
    'Simulação feita com as tabelas oficiais da Receita Federal e os dados que você informou.';
  for (const l of quebrar(aviso, f, 8, CW)) {
    txt(l, M, y - 8, 8, f, NAVY_300);
    y -= 11;
  }
  y -= 12;

  // ---- Chamada
  const ctah = 36;
  pg.drawRectangle({ x: M, y: y - ctah, width: CW, height: ctah, color: AMBER_500 });
  const cta = temEconomia ? 'Responda no WhatsApp para garantir essa economia' : 'Responda no WhatsApp para reduzir o INSS da sua obra';
  const cs = 11;
  txt(cta, M + (CW - fb.widthOfTextAtSize(limpo(cta), cs)) / 2, y - ctah / 2 - cs / 2 + 2, cs, fb, NAVY_950);

  // ---- Rodapé
  pg.drawRectangle({ x: 0, y: 0, width: W, height: FOOTER, color: NAVY_950 });
  txt(`Gabriel Zaneloti · INSS de obras  ·  WhatsApp ${WHATSAPP_DISPLAY}  ·  gabrielzaneloti.com.br`, M, 11, 8, f, NAVY_SUB);
  // O endereço do site no rodapé vira link clicável (com UTM do PDF).
  try {
    const rodape = limpo(`Gabriel Zaneloti · INSS de obras  ·  WhatsApp ${WHATSAPP_DISPLAY}  ·  `);
    const x0 = M + f.widthOfTextAtSize(rodape, 8);
    const x1 = x0 + f.widthOfTextAtSize('gabrielzaneloti.com.br', 8);
    const link = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x0 - 2, 6, x1 + 2, 22],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(LINK_SITE_PDF) },
      }),
    );
    pg.node.set(PDFName.of('Annots'), doc.context.obj([link]));
  } catch {
    // sem o link o PDF sai do mesmo jeito
  }

  return Buffer.from(await doc.save());
}

/**
 * Mensagens que a Lia manda logo depois do PDF (pedido do Gabriel, 27/11): mostrar a economia em porcentagem e deixar o
 * cliente empolgado, em mensagens curtas e separadas, como uma pessoa falando. Sem valores em reais (eles ficam no PDF)
 * e sem nenhuma ressalva ("estimativa", "cerca de", "o Gabriel vai confirmar"). Sem economia, devolve lista vazia.
 */
export function mensagensDaEconomia({ nome = '', r } = {}) {
  const pct = Math.round(Number(r?.percentualReducao) || 0);
  if (!(Number(r?.economiaEstimada) > 0) || pct < 1) return [];
  const primeiro = nomeBonito(String(nome || '').trim().split(/\s+/)[0] || '');
  const abre = primeiro ? `${primeiro}, olha que notícia boa:` : 'Olha que notícia boa:';
  return [
    `${abre} com o planejamento, o INSS da sua obra cai ${pct}%.${pct >= 50 ? ' Mais da metade!' : ''}`,
    'É uma redução grande de verdade. A maioria das pessoas paga o valor cheio porque nem sabe que dá para pagar menos.',
    'E não tem jeitinho nem brecha: tudo segue a Instrução Normativa RFB 2.021/2021, a regra oficial da Receita Federal para obras.',
    'Sinceramente, é o tipo de oportunidade que não dá para deixar passar.',
  ];
}
