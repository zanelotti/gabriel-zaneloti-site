/**
 * Simulação do INSS de obra feita pelo próprio bot, na conversa do WhatsApp (para quem chega pelo botão do site).
 *
 * É a MESMA conta do simulador do site (src/services/calculateINSS.ts, calculateRMTIndireta.ts e calculateFatorAjuste.ts):
 *  1. RMT da obra pela aferição indireta (área x equivalência x VAU do estado x % de mão de obra x categoria x fator social);
 *  2. Fator de Ajuste (50% da RMT até 350 m², 70% acima) com Selic, CPP, multa, mora e MAED mês a mês;
 *  3. comparação com o valor "sem planejamento" (RMT x 36,8%).
 * Se mudar a regra no site, mude aqui também (o teste "bate com o simulador do site" guarda os números).
 *
 * As TABELAS (VAU por estado e Selic mensal) NÃO ficam só aqui: quando o bot liga, ele lê as tabelas do próprio site
 * (../src/data/vauEstadual.ts e selicMensal.ts, que o GitHub atualiza sozinho todo mês). Se não achar a pasta do site,
 * usa a cópia guardada em simulacao-dados.js. Para renovar a cópia: `node scripts/gerar-dados-simulacao.js`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as COPIA from './simulacao-dados.js';
import { formatarReaisInteiros, HONORARIO_MINIMO_PF, primeiroNome } from './util.js';

const ALIQUOTA_CPP = 0.2;
const MULTA_DIARIA_PCT = 0.33;
const MULTA_TETO_PCT = 20;
const MAED_MENSAL = 100;
const DECADENCIA_ANOS = 5;
const TAXA_SEM_FATOR = 0.368;
const MAX_COMPETENCIAS = 5000;
const CORTE_ESOCIAL = '2021-10-01';
const INICIO_JANELA_AJUSTE = '2021-01-01';

export const DESTINACOES = ['residencial_unifamiliar', 'multifamiliar', 'comercial_salas_lojas', 'galpao_industrial', 'conjunto_habitacional', 'edificio_garagem'];
export const TIPOS_OBRA = ['alvenaria', 'madeira', 'mista'];
export const CATEGORIAS = ['obra_nova', 'acrescimo', 'reforma', 'demolicao'];

const DESTINACAO_PARA_VAU = {
  residencial_unifamiliar: 'residencialUnifamiliar',
  multifamiliar: 'residencialMultifamiliar',
  comercial_salas_lojas: 'comercialSalasLojas',
  galpao_industrial: 'galpaoIndustrial',
  conjunto_habitacional: 'conjuntoHabitacionalPopular',
  edificio_garagem: 'edificioGaragens',
};

const ROTULO_DESTINACAO = {
  residencial_unifamiliar: 'casa (residencial unifamiliar)',
  multifamiliar: 'prédio de apartamentos (multifamiliar)',
  comercial_salas_lojas: 'comercial (salas e lojas)',
  galpao_industrial: 'galpão industrial',
  conjunto_habitacional: 'conjunto habitacional',
  edificio_garagem: 'edifício-garagem',
};
const ROTULO_CATEGORIA = { obra_nova: 'obra nova', acrescimo: 'acréscimo', reforma: 'reforma', demolicao: 'demolição' };

// --------------------------------------------------------------------------- tabelas (site ou cópia)
let tabelas = { VAU_ESTADUAL: COPIA.VAU_ESTADUAL, SELIC_MENSAL: COPIA.SELIC_MENSAL, VAU_COMPETENCIA: COPIA.VAU_COMPETENCIA, origem: 'cópia do bot' };
let chavesSelic = [];
function indexarSelic() {
  chavesSelic = Object.keys(tabelas.SELIC_MENSAL).sort();
}
indexarSelic();

export const origemDasTabelas = () => ({ origem: tabelas.origem, vauCompetencia: tabelas.VAU_COMPETENCIA, ultimaSelic: chavesSelic[chavesSelic.length - 1] });

/** Devolve o texto do objeto/valor de `export const NOME ... = <valor>` de um arquivo .ts do site. */
function extrairValor(codigo, nome) {
  const semComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const i = semComentarios.indexOf(`export const ${nome}`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const eq = semComentarios.indexOf('=', i);
  let j = eq + 1;
  while (/\s/.test(semComentarios[j])) j += 1;
  if (semComentarios[j] === "'" || semComentarios[j] === '"') {
    const fim = semComentarios.indexOf(semComentarios[j], j + 1);
    return semComentarios.slice(j, fim + 1);
  }
  let nivel = 0;
  for (let k = j; k < semComentarios.length; k += 1) {
    const c = semComentarios[k];
    if (c === '{') nivel += 1;
    else if (c === '}') {
      nivel -= 1;
      if (nivel === 0) return semComentarios.slice(j, k + 1);
    }
  }
  throw new Error(`não consegui ler ${nome}`);
}

const avaliar = (texto) => new Function(`return (${texto});`)();

/** Lê as tabelas dos arquivos .ts do site. Lança erro se algo não bater (aí o bot continua com as tabelas que já tem). */
export function lerTabelasDoSite(pastaData) {
  const vau = readFileSync(join(pastaData, 'vauEstadual.ts'), 'utf8');
  const selic = readFileSync(join(pastaData, 'selicMensal.ts'), 'utf8');
  const novas = {
    VAU_ESTADUAL: avaliar(extrairValor(vau, 'VAU_ESTADUAL')),
    SELIC_MENSAL: avaliar(extrairValor(selic, 'SELIC_MENSAL')),
    VAU_COMPETENCIA: avaliar(extrairValor(vau, 'VAU_COMPETENCIA')),
  };
  const ufs = Object.keys(novas.VAU_ESTADUAL);
  if (ufs.length < 27) throw new Error(`a tabela VAU tem só ${ufs.length} estados`);
  for (const uf of ufs) {
    for (const campo of Object.values(DESTINACAO_PARA_VAU)) {
      if (!(novas.VAU_ESTADUAL[uf][campo] > 0)) throw new Error(`VAU de ${uf} sem ${campo}`);
    }
  }
  const meses = Object.keys(novas.SELIC_MENSAL);
  if (meses.length < 300 || meses.some((m) => !/^\d{4}-\d{2}$/.test(m) || !Number.isFinite(novas.SELIC_MENSAL[m]))) throw new Error('a tabela da Selic não parece completa');
  return novas;
}

/** Chamada quando o bot liga: usa as tabelas do site (sempre as mais novas); se não der, mantém a cópia do bot. */
export function sincronizarTabelasDoSite({ log = console, pasta = null } = {}) {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const pastaData = pasta || join(aqui, '..', '..', 'src', 'data');
  try {
    if (!existsSync(join(pastaData, 'vauEstadual.ts'))) {
      log.warn(`[simulacao] não achei as tabelas do site em ${pastaData}; usando a cópia guardada no bot (VAU de ${tabelas.VAU_COMPETENCIA}).`);
      return false;
    }
    tabelas = { ...lerTabelasDoSite(pastaData), origem: 'site' };
    indexarSelic();
    log.info(`[simulacao] tabelas do site carregadas (VAU de ${tabelas.VAU_COMPETENCIA}, Selic até ${chavesSelic[chavesSelic.length - 1]}).`);
    return true;
  } catch (e) {
    log.warn(`[simulacao] não consegui ler as tabelas do site (${e.message}); usando a cópia guardada no bot.`);
    return false;
  }
}

// --------------------------------------------------------------------------- competências e Selic (src/data/selicMensal.ts)
const round2 = (v) => Number(v.toFixed(2));

function toCompetenciaKey(input) {
  if (input instanceof Date) return `${String(input.getUTCFullYear()).padStart(4, '0')}-${String(input.getUTCMonth() + 1).padStart(2, '0')}`;
  const [anoBruto, mesBruto] = String(input).split('-');
  return `${(anoBruto ?? '').padStart(4, '0')}-${(mesBruto ?? '01').padStart(2, '0')}`;
}
function addMonths(key, months) {
  const [ano, mes] = key.split('-').map(Number);
  return toCompetenciaKey(new Date(Date.UTC(ano, mes - 1 + months, 1)));
}
const compareCompetencia = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function taxaSelicDoMes(competencia) {
  const primeira = chavesSelic[0];
  const ultima = chavesSelic[chavesSelic.length - 1];
  const chave = compareCompetencia(competencia, primeira) < 0 ? primeira : compareCompetencia(competencia, ultima) > 0 ? ultima : competencia;
  return tabelas.SELIC_MENSAL[chave];
}

function calcularSelicAcumulada(competencia, referencia) {
  const fimSoma = addMonths(referencia, -1);
  let cursor = addMonths(competencia, 2);
  let acumulado = 0;
  let meses = 0;
  while (compareCompetencia(cursor, fimSoma) <= 0) {
    if (meses > 5000) break;
    acumulado += taxaSelicDoMes(cursor);
    cursor = addMonths(cursor, 1);
    meses += 1;
  }
  return Number((acumulado + 1).toFixed(2));
}

// --------------------------------------------------------------------------- RMT (aferição indireta)
function percentualEquivalencia(destinacao, area) {
  switch (destinacao) {
    case 'residencial_unifamiliar':
      return area <= 1000 ? 0.89 : 0.85;
    case 'multifamiliar':
      return area <= 1000 ? 0.9 : 0.86;
    case 'comercial_salas_lojas':
    case 'edificio_garagem':
      return area <= 3000 ? 0.86 : 0.83;
    case 'galpao_industrial':
      return 0.95;
    case 'conjunto_habitacional':
      return 0.98;
    default:
      return 0.9;
  }
}
function percentualMaoDeObra(tipoObra, destinacao) {
  if (destinacao === 'conjunto_habitacional') return tipoObra === 'alvenaria' ? 0.12 : 0.07;
  return tipoObra === 'alvenaria' ? 0.2 : 0.15;
}
const percentualCategoria = (categoria) => (categoria === 'reforma' ? 0.35 : categoria === 'demolicao' ? 0.1 : 1);
const percentualDestinacao = (destinacao) => (destinacao === 'edificio_garagem' ? 0.8 : 1);
function percentualFatorSocial(areaTotal) {
  if (areaTotal <= 100) return 0.2;
  if (areaTotal <= 200) return 0.4;
  if (areaTotal <= 300) return 0.55;
  if (areaTotal <= 400) return 0.7;
  return 0.9;
}

function calcularRMTIndireta({ estado, destinacao, tipoObra, categoria, responsavel, areaPrincipal, areaComplementar }) {
  const campoVau = DESTINACAO_PARA_VAU[destinacao];
  const vauEstado = tabelas.VAU_ESTADUAL[estado];
  const medio = () => {
    const v = Object.values(tabelas.VAU_ESTADUAL).map((t) => t[campoVau]);
    return v.reduce((s, x) => s + x, 0) / v.length;
  };
  const vauPorM2 = vauEstado ? vauEstado[campoVau] : medio();
  const principal = Math.max(0, areaPrincipal);
  const complementar = Math.max(0, areaComplementar ?? 0);
  const areaTotal = principal + complementar;

  const equivalencia = percentualEquivalencia(destinacao, principal);
  const custoPrincipal = round2(round2(principal * equivalencia) * vauPorM2);
  const custoComplementar = round2(round2(complementar * 0.25) * vauPorM2);
  const multiplicador = percentualMaoDeObra(tipoObra, destinacao) * percentualCategoria(categoria) * percentualDestinacao(destinacao) * (responsavel === 'PF' ? percentualFatorSocial(areaTotal) : 1);
  return { rmt100: round2(round2(custoPrincipal * multiplicador) + round2(custoComplementar * multiplicador)), areaTotal, vauPorM2 };
}

// --------------------------------------------------------------------------- Fator de Ajuste (mês a mês)
const anoDe = (d) => Number(String(d).slice(0, 4));
const competenciaDecaida = (competencia, dataCalculo) => anoDe(dataCalculo) - anoDe(competencia) > DECADENCIA_ANOS;

function listarCompetencias(inicio, fim) {
  let a = toCompetenciaKey(inicio);
  let b = toCompetenciaKey(fim);
  if (compareCompetencia(a, b) > 0) [a, b] = [b, a];
  const lista = [];
  let cursor = a;
  while (compareCompetencia(cursor, b) <= 0) {
    lista.push(cursor);
    if (lista.length >= MAX_COMPETENCIAS) break;
    cursor = addMonths(cursor, 1);
  }
  return lista;
}

function diasDeAtraso(competencia, dataCalculo) {
  const [ano, mes] = competencia.split('-').map(Number);
  const vencimento = new Date(Date.UTC(ano, mes, 20));
  return Math.max(0, Math.floor((dataCalculo.getTime() - vencimento.getTime()) / 86_400_000));
}

function linhaMensal(competencia, remAtual, referencia, dataCalculo) {
  const dias = diasDeAtraso(competencia, dataCalculo);
  if (dias === 0) {
    const cpp = round2(remAtual * ALIQUOTA_CPP);
    return { competencia, cpp, multa: 0, mora: 0, maed: 0, total: cpp, emAtraso: false };
  }
  const selicPct = calcularSelicAcumulada(competencia, referencia);
  const remOrig = remAtual / (1 + selicPct / 100);
  const cpp = round2(remOrig * ALIQUOTA_CPP);
  const multaPct = Math.min(MULTA_TETO_PCT, Number((dias * MULTA_DIARIA_PCT).toFixed(2)));
  const multa = round2(cpp * (multaPct / 100));
  const mora = round2(cpp * (selicPct / 100));
  return { competencia, cpp, multa, mora, maed: MAED_MENSAL, total: round2(cpp + multa + mora + MAED_MENSAL), emAtraso: true };
}

const somar = (linhas) => round2(linhas.reduce((s, l) => s + l.total, 0));

function calcularFatorAjuste({ rmt100, areaM2, dataInicio, dataFim, responsavel, dataCalculo }) {
  const todas = listarCompetencias(dataInicio, dataFim);
  const competencias = todas.filter((c) => !competenciaDecaida(c, dataCalculo));
  const fracaoCobravel = todas.length > 0 ? competencias.length / todas.length : 0;
  const percentualFator = areaM2 <= 350 ? 50 : 70;
  const rmtAjustada = rmt100 * (percentualFator / 100);
  const remAtual = rmtAjustada / todas.length;
  const referencia = toCompetenciaKey(dataCalculo);
  const dataCalc = new Date(`${dataCalculo}T00:00:00Z`);
  const linhas = competencias.map((c) => linhaMensal(c, remAtual, referencia, dataCalc));
  const totalComFator = somar(linhas);
  const totalSemFator = round2(rmt100 * TAXA_SEM_FATOR * fracaoCobravel);
  const reducao = round2(totalSemFator - totalComFator);
  const reducaoPercentual = totalSemFator > 0 ? Number(((reducao / totalSemFator) * 100).toFixed(2)) : 0;
  const totalEmAtraso = somar(linhas.filter((l) => l.emAtraso));
  const parcelaMinima = responsavel === 'PF' ? 200 : 500;
  const aplicavel = totalEmAtraso > 0;
  const numeroParcelas = aplicavel ? Math.max(1, Math.min(60, Math.floor(totalEmAtraso / parcelaMinima))) : 0;
  return {
    percentualFator,
    numeroMeses: competencias.length,
    numeroMesesTotal: todas.length,
    rmtAjustada: round2(rmtAjustada),
    linhas,
    totalComFator,
    totalSemFator,
    reducao,
    reducaoPercentual,
    parcelamento: { aplicavel, totalParcelavel: totalEmAtraso, numeroParcelas, valorParcela: aplicavel ? round2(totalEmAtraso / numeroParcelas) : 0 },
  };
}

// --------------------------------------------------------------------------- simulação completa
export function regimeDaObra(dataInicio) {
  if (dataInicio >= CORTE_ESOCIAL) return 'esocial';
  if (dataInicio >= INICIO_JANELA_AJUSTE) return 'esocial_ajustado';
  return 'gfip_anterior_2021';
}

const hojeISO = () => new Date().toISOString().slice(0, 10);
const maxISO = (a, b) => (a > b ? a : b);

/**
 * Mesma conta do site (calculateINSS), para pessoa física.
 * @param {{estado:string,destinacao:string,tipoObra:string,categoria:string,areaPrincipal:number,areaComplementar?:number|null,dataInicio:string,dataFim?:string|null}} d
 * @param {{hoje?: string}} [op] data do cálculo ("AAAA-MM-DD"); o padrão é hoje (os testes fixam a data)
 */
export function simular(d, { hoje = hojeISO() } = {}) {
  const dataInicio = d.dataInicio || hoje;
  const regime = regimeDaObra(dataInicio);
  const rmt = calcularRMTIndireta({ ...d, responsavel: 'PF' });
  const dataFimEfetiva = d.dataFim || maxISO(dataInicio, hoje);
  const inicioCalculo = regime === 'esocial_ajustado' ? CORTE_ESOCIAL : dataInicio;
  const fimCalculo = maxISO(inicioCalculo, dataFimEfetiva);
  const f = calcularFatorAjuste({ rmt100: rmt.rmt100, areaM2: rmt.areaTotal, dataInicio: inicioCalculo, dataFim: fimCalculo, responsavel: 'PF', dataCalculo: hoje });
  const honorarios = round2(Math.max(HONORARIO_MINIMO_PF, f.reducao * 0.12));
  return {
    regime,
    dataCalculo: hoje,
    inssEstimado: f.totalSemFator,
    economiaEstimada: f.reducao,
    percentualReducao: f.reducaoPercentual,
    valorAposReducao: f.totalComFator,
    parcelamento: f.parcelamento,
    detalhe: {
      rmt100: round2(rmt.rmt100),
      areaTotal: rmt.areaTotal,
      vauPorM2: rmt.vauPorM2,
      percentualFator: f.percentualFator,
      numeroMeses: f.numeroMeses,
      numeroMesesTotal: f.numeroMesesTotal,
      honorarios,
      reducaoLiquida: round2(f.reducao - honorarios),
      dataInicioAjustada: regime === 'esocial_ajustado' ? inicioCalculo : undefined,
      linhas: f.linhas,
    },
  };
}

// --------------------------------------------------------------------------- dados que o assistente colhe na conversa
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function lerNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/** "2023-03", "2023-03-15" ou "03/2023" viram "2023-03-01". Vazio devolve null; formato estranho devolve undefined. */
function lerData(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${(m[3] || '01').padStart(2, '0')}`;
  m = /^(?:(\d{1,2})\/)?(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${(m[1] || '01').padStart(2, '0')}`;
  return undefined;
}

const UFS = () => Object.keys(tabelas.VAU_ESTADUAL);

/**
 * Confere o que o assistente mandou para calcular_simulacao.
 * @returns {{ok: true, dados: object} | {ok: false, erro: string, faltando?: string[]}}
 */
export function normalizarEntrada(args = {}, { hoje = hojeISO() } = {}) {
  const resp = /^pj$|jur[ií]dic|empresa|cnpj/i.test(semAcento(args.responsavel)) ? 'PJ' : /^pf$|f[ií]sica|^pessoa|cpf/i.test(semAcento(args.responsavel)) ? 'PF' : '';
  if (!resp) return { ok: false, erro: 'diga se a obra é de pessoa física (PF) ou de empresa (PJ)', faltando: ['responsavel'] };

  const dados = { responsavel: resp };
  const erros = [];
  const faltando = [];

  const uf = String(args.estado ?? '').trim().toUpperCase();
  if (uf) {
    if (UFS().includes(uf)) dados.estado = uf;
    else erros.push(`estado "${args.estado}" não é uma sigla válida (use a sigla com 2 letras, ex.: SP)`);
  }
  const dest = semAcento(args.destinacao).replace(/\s+/g, '_');
  if (dest) {
    if (DESTINACOES.includes(dest)) dados.destinacao = dest;
    else erros.push(`destinacao "${args.destinacao}" inválida (use: ${DESTINACOES.join(', ')})`);
  }
  const tipo = semAcento(args.tipo_obra);
  if (tipo) {
    if (TIPOS_OBRA.includes(tipo)) dados.tipoObra = tipo;
    else erros.push(`tipo_obra "${args.tipo_obra}" inválido (use: ${TIPOS_OBRA.join(', ')})`);
  }
  const cat = semAcento(args.categoria).replace(/\s+/g, '_');
  if (cat) {
    if (CATEGORIAS.includes(cat)) dados.categoria = cat;
    else erros.push(`categoria "${args.categoria}" inválida (use: ${CATEGORIAS.join(', ')})`);
  }
  const area = lerNumero(args.area_principal);
  if (area !== null) {
    if (Number.isNaN(area) || area < 5 || area > 200000) erros.push(`área principal "${args.area_principal}" não parece certa (informe só o número em m²)`);
    else dados.areaPrincipal = area;
  }
  const compl = lerNumero(args.area_complementar);
  if (compl !== null) {
    if (Number.isNaN(compl) || compl < 0 || compl > 200000) erros.push(`área complementar "${args.area_complementar}" não parece certa`);
    else dados.areaComplementar = compl;
  }
  const inicio = lerData(args.data_inicio);
  if (inicio === undefined) erros.push(`data_inicio "${args.data_inicio}" em formato estranho (use AAAA-MM ou AAAA-MM-DD)`);
  else if (inicio) {
    if (inicio < '1990-01-01' || inicio > `${Number(hoje.slice(0, 4)) + 5}-12-31`) erros.push(`data de início ${inicio} não parece certa`);
    else dados.dataInicio = inicio;
  }
  const fim = lerData(args.data_fim);
  if (fim === undefined) erros.push(`data_fim "${args.data_fim}" em formato estranho (use AAAA-MM ou AAAA-MM-DD, ou deixe vazio se a obra está em andamento)`);
  else if (fim) {
    if (fim < '1990-01-01' || fim > `${Number(hoje.slice(0, 4)) + 5}-12-31`) erros.push(`data de término ${fim} não parece certa`);
    else dados.dataFim = fim;
  }
  if (dados.dataInicio && dados.dataFim && dados.dataFim.slice(0, 7) < dados.dataInicio.slice(0, 7)) erros.push('a data de término é anterior à de início: confirme as datas com a pessoa');
  if (erros.length) return { ok: false, erro: erros.join('; ') };

  if (resp === 'PJ') return { ok: true, dados }; // empresa: só registra os dados; não há simulação com valores

  for (const [campo, chave] of [['estado', 'estado'], ['destinacao', 'destinacao'], ['tipo_obra', 'tipoObra'], ['categoria', 'categoria'], ['area_principal', 'areaPrincipal'], ['data_inicio', 'dataInicio']]) {
    if (dados[chave] === undefined) faltando.push(campo);
  }
  if (faltando.length) return { ok: false, erro: `falta informar: ${faltando.join(', ')}. Pergunte à pessoa só o que falta`, faltando };
  return { ok: true, dados };
}

/** Colunas da tabela `leads` (CRM) preenchidas com o que a pessoa informou e, se houver, com o resultado. */
export function camposDoLead(dados, r = null) {
  const campos = {
    responsavel: dados.responsavel,
    ...(dados.estado ? { estado: dados.estado } : {}),
    ...(dados.destinacao ? { destinacao: dados.destinacao } : {}),
    ...(dados.tipoObra ? { tipo_obra: dados.tipoObra } : {}),
    ...(dados.categoria ? { categoria: dados.categoria } : {}),
    ...(dados.areaPrincipal ? { area_principal: dados.areaPrincipal } : {}),
    ...(dados.areaComplementar ? { area_piscina: dados.areaComplementar } : {}),
    ...(dados.dataInicio ? { data_inicio: dados.dataInicio } : {}),
    ...(dados.dataFim ? { data_fim: dados.dataFim } : {}),
  };
  if (r) {
    campos.inss_estimado = r.inssEstimado;
    // Obra anterior a 2021 ou sem redução: o site também não mostra economia (o caso é de análise).
    const temEconomia = r.regime !== 'gfip_anterior_2021' && r.economiaEstimada > 0;
    campos.economia_estimada = temEconomia ? r.economiaEstimada : null;
    campos.percentual_reducao = temEconomia ? r.percentualReducao : null;
    campos.valor_apos_reducao = temEconomia ? r.valorAposReducao : null;
  }
  return campos;
}

// --------------------------------------------------------------------------- textos
const mesAno = (iso) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const reais = formatarReaisInteiros;

function descreverObra(d) {
  const partes = [ROTULO_DESTINACAO[d.destinacao], d.tipoObra, ROTULO_CATEGORIA[d.categoria]];
  const areas = `${Number(d.areaPrincipal).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²${d.areaComplementar ? ` + ${Number(d.areaComplementar).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m² de área complementar` : ''}`;
  return `${partes.join(', ')}, ${areas}, ${d.estado}`;
}

/** A simulação que vai para o WhatsApp da pessoa. Só números que o sistema calculou; nunca honorário nem "quanto sobra". */
export function montarMensagemSimulacao(d, r, { nome = '' } = {}) {
  const oi = nome ? `Pronto, ${primeiroNome(nome)}!` : 'Pronto!';
  const periodo = d.dataFim ? `${mesAno(d.dataInicio)} a ${mesAno(d.dataFim)}` : `${mesAno(d.dataInicio)} até hoje (obra em andamento)`;
  const topo = `${oi} Esta é a simulação da sua obra (estimativa inicial, feita com as tabelas oficiais):\n• Obra: ${descreverObra(d)}\n• Período: ${periodo}`;

  if (r.regime === 'gfip_anterior_2021' && r.inssEstimado <= 0) {
    return `${topo}\n\nPelo prazo de 5 anos que a Receita tem para cobrar, essa obra pode já estar fora da cobrança. Isso se comprova com documentos da época da obra (habite-se, alvará, IPTU, contas de consumo), e o Gabriel confirma no seu caso.`;
  }
  if (r.regime === 'gfip_anterior_2021') {
    return `${topo}\n• INSS estimado sem planejamento: ${reais(r.inssEstimado)}\n\nComo a obra começou antes de 2021, a redução depende de uma análise do período (a Receita só cobra os últimos 5 anos) e dos documentos da época. O Gabriel faz essa análise e confirma o valor.`;
  }
  if (!(r.economiaEstimada > 0)) {
    return `${topo}\n• INSS estimado sem planejamento: ${reais(r.inssEstimado)}\n\nCom esses dados, o Fator de Ajuste sozinho não mostra economia, mas há outras frentes (notas fiscais, mão de obra comprovada, tempo da obra). O Gabriel analisa o seu caso e confirma o que vale.`;
  }
  const parcela = r.parcelamento?.aplicavel ? `\nO saldo ainda pode ser parcelado em até ${r.parcelamento.numeroParcelas} vezes (parcelas de cerca de ${reais(r.parcelamento.valorParcela)}).` : '';
  return `${topo}\n• INSS estimado sem planejamento: ${reais(r.inssEstimado)}\n• Com o Fator de Ajuste (${r.detalhe.percentualFator}%): ${reais(r.valorAposReducao)}\n• Economia estimada: ${reais(r.economiaEstimada)} (${Number(r.percentualReducao).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%)${parcela}\n\nÉ uma estimativa: o Gabriel confirma o valor final na análise dos documentos da obra.`;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** E-mail para o Gabriel: dados da obra, resultado completo, honorário e linha a linha (uso interno). */
export function montarEmailSimulacao({ nome, telefone, origem, dados, r, historicoNota = '' }) {
  const linha = (rotulo, valor) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">${esc(rotulo)}</td><td style="padding:4px 0;font-size:14px;font-weight:600;">${valor}</td></tr>`;
  const link = telefone ? `https://wa.me/${telefone}` : null;
  const honor = r.detalhe.honorarios;
  const tabela = r.detalhe.linhas.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:6px;"><tr style="background:#f3f4f6;"><th align="left" style="padding:4px;">Mês</th><th align="right" style="padding:4px;">CPP</th><th align="right" style="padding:4px;">Multa</th><th align="right" style="padding:4px;">Mora</th><th align="right" style="padding:4px;">MAED</th><th align="right" style="padding:4px;">Total</th></tr>${r.detalhe.linhas
        .map((l) => `<tr><td style="padding:3px 4px;">${mesAno(`${l.competencia}-01`)}</td><td align="right">${brl(l.cpp)}</td><td align="right">${brl(l.multa)}</td><td align="right">${brl(l.mora)}</td><td align="right">${brl(l.maed)}</td><td align="right"><strong>${brl(l.total)}</strong></td></tr>`)
        .join('')}</table>`
    : '';
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;color:#111827;">
      <h2 style="margin:0 0 4px;font-size:18px;">Simulação feita pelo bot: ${esc(nome || 'Lead')}</h2>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;">Contato pelo WhatsApp (${esc(origem || 'site')}). Esta mesma simulação já foi enviada na conversa com a pessoa.</p>
      <table style="margin:0 0 14px;">
        ${linha('WhatsApp', esc(telefone || ''))}
        ${linha('Obra', esc(descreverObra(dados)))}
        ${linha('Período', esc(`${mesAno(dados.dataInicio)} a ${dados.dataFim ? mesAno(dados.dataFim) : 'hoje (em andamento)'}`))}
        ${linha('Regime', esc(r.regime === 'esocial' ? 'eSocial' : r.regime === 'esocial_ajustado' ? 'eSocial (início deslocado para 10/2021)' : 'GFIP (obra anterior a 2021: sem redução automática)'))}
      </table>
      <h3 style="margin:0 0 6px;font-size:15px;">Resultado</h3>
      <table style="margin:0 0 14px;">
        ${linha('INSS estimado sem planejamento', brl(r.inssEstimado))}
        ${linha(`Com o Fator de Ajuste (${r.detalhe.percentualFator}%)`, brl(r.valorAposReducao))}
        ${linha('Economia estimada', `${brl(r.economiaEstimada)} (${Number(r.percentualReducao).toLocaleString('pt-BR')}%)`)}
        ${linha('Honorário (12%, valor mínimo R$ 800)', brl(honor))}
        ${linha('Economia líquida do cliente', brl(r.detalhe.reducaoLiquida))}
        ${linha('RMT a 100%', brl(r.detalhe.rmt100))}
        ${linha('Meses cobráveis / meses da obra', `${r.detalhe.numeroMeses} / ${r.detalhe.numeroMesesTotal}`)}
        ${r.parcelamento?.aplicavel ? linha('Parcelamento do saldo em atraso', `${r.parcelamento.numeroParcelas}x de ${brl(r.parcelamento.valorParcela)}`) : ''}
      </table>
      ${historicoNota ? `<p style="font-size:13px;color:#374151;">${esc(historicoNota)}</p>` : ''}
      ${link ? `<a href="${link}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">Abrir conversa no WhatsApp</a>` : ''}
      <h3 style="margin:22px 0 0;font-size:15px;">Mês a mês (uso interno)</h3>
      ${tabela}
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">Estimativa calculada pelo bot com as mesmas tabelas do simulador do site (VAU de ${esc(tabelas.VAU_COMPETENCIA)}). O cliente não vê honorário nem economia líquida.</p>
    </div>`;
  return { assunto: `Simulação feita pelo bot: ${nome || 'Lead'}`, html };
}
