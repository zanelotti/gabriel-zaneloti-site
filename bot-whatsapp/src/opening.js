/**
 * Primeira mensagem enviada ao lead (a mesma lógica do aviso por e-mail do site,
 * em notify-lead.js), com uma diferença deliberada: o bot se apresenta pelo nome
 * (ASSISTENTE_NOME) como assistente do Gabriel, e não como se fosse o próprio Gabriel.
 *
 * Regras de conteúdo (alinhadas com o Gabriel): nada de "só paga se economizar",
 * sem mencionar honorários na abertura, e sem as palavras "legal", "jurídico",
 * "direito" ou "advogado". O valor de economia NUNCA é citado para pessoa jurídica
 * (o Fator de Ajuste só vale para pessoa física).
 */
import { formatarArea, formatarReaisInteiros, primeiroNomePessoa, regimeApuracao } from './util.js';

const ECONOMIA_GRANDE_MIN = 30000;
const REDUCAO_GRANDE_MIN = 70;
const ECONOMIA_PEQUENA_MAX = 5000;

export function montarAbertura(lead, nomeAssistente = 'Lia') {
  const isPJ = lead.responsavel === 'PJ';
  const primeiro = primeiroNomePessoa(lead.nome); // empresa/sigla/vazio: abre sem nome (a assistente pergunta depois)
  const saudacao = primeiro
    ? `Oi, ${primeiro}, tudo bem? Aqui é ${nomeAssistente}, assistente do Gabriel Zaneloti, da regularização de INSS de obra.`
    : `Oi, tudo bem? Aqui é ${nomeAssistente}, assistente do Gabriel Zaneloti, da regularização de INSS de obra.`;

  const area = Number(lead.area_principal);
  const obra = Number.isFinite(area) && area > 0 ? `a obra de ${formatarArea(area)}` : 'a sua obra';

  const economia = Number(lead.economia_estimada);
  const temEconomia =
    !isPJ && lead.economia_estimada !== null && lead.economia_estimada !== undefined && Number.isFinite(economia) && economia > 0;
  const gfipAnterior = !isPJ && regimeApuracao(lead.data_inicio) === 'gfip_anterior_2021';
  const semCalculo = !isPJ && (lead.inss_estimado === null || lead.inss_estimado === undefined);

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
    corpo = `Vi que você simulou ${obra} aqui no site, e a estimativa de economia ficou em torno de ${formatarReaisInteiros(economia)} em relação ao que a Receita cobraria sem revisão. Parece bom demais para ser verdade, né? Esta é uma hora ruim para eu te explicar de onde vem esse número?`;
  } else if (temEconomia && economia < ECONOMIA_PEQUENA_MAX) {
    variante = 'Economia pequena';
    corpo = `Vi que você simulou ${obra} aqui no site, e a estimativa de economia ficou em torno de ${formatarReaisInteiros(economia)}. O que você esperava ver nesse resultado?`;
  } else if (temEconomia) {
    variante = 'Economia média';
    corpo = `Vi que você simulou ${obra} aqui no site, e a estimativa de economia ficou em torno de ${formatarReaisInteiros(economia)} em relação ao que a Receita cobraria sem revisão. Pode ser que esse número tenha gerado dúvida. Esta é uma hora ruim para eu te explicar de onde ele vem?`;
  } else {
    variante = 'Padrão';
    corpo = `Vi que você simulou ${obra} aqui no site. Esta é uma hora ruim para eu te explicar como funciona a redução no seu caso?`;
  }

  return { variante, texto: `${saudacao} ${corpo}` };
}
