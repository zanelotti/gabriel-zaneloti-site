/**
 * Primeira mensagem enviada ao lead (a mesma lógica do aviso por e-mail do site,
 * em notify-lead.js), com uma diferença deliberada: o bot se apresenta pelo nome
 * (ASSISTENTE_NOME) como assistente do Gabriel, e não como se fosse o próprio Gabriel.
 *
 * Regras de conteúdo (alinhadas com o Gabriel): nada de "só paga se economizar",
 * sem mencionar honorários na abertura, e sem as palavras "legal", "direito" ou "advogado"
 * (nem "jurídico" fora de "pessoa jurídica"). O valor de economia NUNCA é citado para pessoa jurídica
 * (o Fator de Ajuste só vale para pessoa física).
 */
import { formatarArea, formatarReaisInteiros, primeiroNomePessoa, regimeApuracao } from './util.js';

const ECONOMIA_GRANDE_MIN = 30000;
const REDUCAO_GRANDE_MIN = 70;
const ECONOMIA_PEQUENA_MAX = 5000;

const numeroOk = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/**
 * Os números que o site mostrou ao lead, para ele se lembrar: o que a Receita cobraria, o que ficaria com o
 * planejamento, quanto isso representa e o percentual de economia. Só pessoa física, e só quando o site calculou tudo.
 */
function corpoComValores(lead, obra) {
  if (!numeroOk(lead.inss_estimado) || !numeroOk(lead.valor_apos_reducao) || !numeroOk(lead.economia_estimada)) return '';
  const sem = Number(lead.inss_estimado);
  const com = Number(lead.valor_apos_reducao);
  const eco = Number(lead.economia_estimada);
  let pct = numeroOk(lead.percentual_reducao) ? Number(lead.percentual_reducao) : NaN;
  if (!Number.isFinite(pct) && sem > 0) pct = (eco / sem) * 100;
  const pctTxt = Number.isFinite(pct) && pct > 0 ? ` (cerca de ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%) de economia` : '';
  return `Vi que você simulou ${obra} aqui no site, e a estimativa do valor cobrado pela Receita Federal foi de ${formatarReaisInteiros(sem)}. Com nosso planejamento o INSS da obra ficaria em ${formatarReaisInteiros(com)}; isso representa ${formatarReaisInteiros(eco)}${pctTxt}. Posso te explicar rapidinho de onde vêm esses números?`;
}

const FRASE_PARCELAMENTO = 'E o saldo do INSS da obra ainda pode ser parcelado em até 60 vezes.';

/** Coloca a vantagem do parcelamento antes da pergunta final da abertura, para o lead já saber que ela existe. */
function comParcelamento(corpo) {
  let corte = -1;
  for (const m of corpo.matchAll(/[.!?] /g)) corte = m.index + 2;
  if (corte < 0) return `${FRASE_PARCELAMENTO} ${corpo}`;
  return `${corpo.slice(0, corte)}${FRASE_PARCELAMENTO} ${corpo.slice(corte)}`;
}

export function montarAbertura(lead, nomeAssistente = 'Lia') {
  const isPJ = lead.responsavel === 'PJ';
  const primeiro = primeiroNomePessoa(lead.nome); // empresa/sigla/vazio: abre sem nome (a assistente pergunta depois)
  const saudacao = primeiro
    ? `Oi, ${primeiro}, tudo bem? Aqui é ${nomeAssistente}, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra.`
    : `Oi, tudo bem? Aqui é ${nomeAssistente}, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra.`;

  // A área da obra na mensagem é a soma da área principal com a complementar (piscina, garagem coberta etc.).
  const complementar = Number(lead.area_piscina);
  const area = Number(lead.area_principal) + (Number.isFinite(complementar) && complementar > 0 ? complementar : 0);
  const obra = Number.isFinite(area) && area > 0 ? `a obra de ${formatarArea(area)}` : 'a sua obra';

  const economia = Number(lead.economia_estimada);
  const temEconomia =
    !isPJ && lead.economia_estimada !== null && lead.economia_estimada !== undefined && Number.isFinite(economia) && economia > 0;
  const gfipAnterior = !isPJ && regimeApuracao(lead.data_inicio) === 'gfip_anterior_2021';
  const semCalculo = !isPJ && (lead.inss_estimado === null || lead.inss_estimado === undefined);

  const valores = temEconomia ? corpoComValores(lead, obra) : '';
  let variante;
  let corpo;

  if (isPJ) {
    variante = 'PJ';
    corpo = `Vi que você simulou a regularização do INSS da obra da sua empresa aqui no site. Para obra feita em nome de empresa o caminho de redução é outro (contabilidade da obra, desoneração da folha, créditos abatíveis) e depende de cada empresa. Parece que o número que apareceu no site deixou dúvida sobre o que dá para reduzir. Está podendo conversar sobre a regularização da sua obra rapidinho?`;
  } else if (gfipAnterior) {
    variante = 'Obra antes de 10/2021';
    corpo = `Vi que você simulou ${obra} aqui no site. Obra iniciada antes de 2021 tem um cálculo diferente, e podem existir pontos que mudam o valor e que o site não consegue mostrar. Parece que ficou a dúvida de quanto você realmente vai pagar. Esta é uma hora ruim para eu te explicar?`;
  } else if (semCalculo) {
    variante = 'Sem estimativa automática';
    corpo = `Vi que você simulou ${obra} aqui no site, e o cálculo automático não conseguiu fechar uma estimativa para o seu caso. Isso costuma indicar que vale olhar com cuidado. Esta é uma hora ruim para eu entender melhor a sua obra?`;
  } else if (temEconomia && (economia >= ECONOMIA_GRANDE_MIN || Number(lead.percentual_reducao) >= REDUCAO_GRANDE_MIN)) {
    variante = 'Economia grande';
    corpo = valores || `Vi que você simulou ${obra} aqui no site, e a estimativa de economia ficou em torno de ${formatarReaisInteiros(economia)} em relação ao que a Receita cobraria sem revisão. Parece bom demais para ser verdade, né? Esta é uma hora ruim para eu te explicar de onde vem esse número?`;
  } else if (temEconomia && economia < ECONOMIA_PEQUENA_MAX) {
    variante = 'Economia pequena';
    corpo = valores || `Vi que você simulou ${obra} aqui no site, e a estimativa de economia ficou em torno de ${formatarReaisInteiros(economia)}. O que você esperava ver nesse resultado?`;
  } else if (temEconomia) {
    variante = 'Economia média';
    corpo = valores || `Vi que você simulou ${obra} aqui no site, e a estimativa de economia ficou em torno de ${formatarReaisInteiros(economia)} em relação ao que a Receita cobraria sem revisão. Pode ser que esse número tenha gerado dúvida. Esta é uma hora ruim para eu te explicar de onde ele vem?`;
  } else {
    variante = 'Padrão';
    corpo = `Vi que você simulou ${obra} aqui no site. Esta é uma hora ruim para eu te explicar como funciona a redução no seu caso?`;
  }

  return { variante, texto: `${saudacao} ${comParcelamento(corpo)}` };
}
