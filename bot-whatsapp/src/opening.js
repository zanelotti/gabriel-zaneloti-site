/**
 * Primeira mensagem enviada ao lead (a mesma lógica do aviso por e-mail do site,
 * em notify-lead.js), com uma diferença deliberada: o bot se apresenta pelo nome
 * (ASSISTENTE_NOME) como assistente do Gabriel, e não como se fosse o próprio Gabriel.
 *
 * IMPORTANTE: o site NÃO mostra mais o resultado do cálculo ao visitante. Por isso a abertura NÃO cita nenhum valor
 * (INSS, economia, honorário): ela apresenta o valor do SERVIÇO (reduzir o INSS, cuidar de tudo, parcelar o saldo em até
 * 60 vezes) e puxa conversa sobre a obra. Os números só aparecem depois, na conversa, na hora certa.
 *
 * Regras de conteúdo (alinhadas com o Gabriel): nada de "só paga se economizar",
 * sem mencionar honorários na abertura, e sem as palavras "legal", "direito" ou "advogado"
 * (nem "jurídico" fora de "pessoa jurídica").
 */
import { montarAberturaEbook, ehLeadExterno } from './origem.js';
import { formatarArea, leadValorAlto, primeiroNomePessoa, regimeApuracao } from './util.js';

const FRASE_PARCELAMENTO = 'E o saldo do INSS da obra ainda pode ser parcelado em até 60 vezes.';

/** Coloca a vantagem do parcelamento antes da pergunta final da abertura, para o lead já saber que ela existe. */
function comParcelamento(corpo) {
  let corte = -1;
  for (const m of corpo.matchAll(/[.!?] /g)) corte = m.index + 2;
  if (corte < 0) return `${FRASE_PARCELAMENTO} ${corpo}`;
  return `${corpo.slice(0, corte)}${FRASE_PARCELAMENTO} ${corpo.slice(corte)}`;
}

export function montarAbertura(lead, nomeAssistente = 'Lia', config = {}) {
  // Quem baixou o e-book (sem simulação): abertura própria, sem números.
  if (ehLeadExterno(lead)) return montarAberturaEbook({ nome: primeiroNomePessoa(lead.nome), assistente: nomeAssistente });
  const isPJ = lead.responsavel === 'PJ';
  const primeiro = primeiroNomePessoa(lead.nome); // empresa/sigla/vazio: abre sem nome (a assistente pergunta depois)
  const saudacao = primeiro
    ? `Oi, ${primeiro}, tudo bem? Aqui é ${nomeAssistente}, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra.`
    : `Oi, tudo bem? Aqui é ${nomeAssistente}, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra.`;

  // A área da obra na mensagem é a soma da área principal com a complementar (piscina, garagem coberta etc.).
  const complementar = Number(lead.area_piscina);
  const area = Number(lead.area_principal) + (Number.isFinite(complementar) && complementar > 0 ? complementar : 0);
  const obra = Number.isFinite(area) && area > 0 ? `da obra de ${formatarArea(area)}` : 'da sua obra';

  const gfipAnterior = !isPJ && regimeApuracao(lead.data_inicio) === 'gfip_anterior_2021';
  const semCalculo = !isPJ && (lead.inss_estimado === null || lead.inss_estimado === undefined);
  const valorAlto = leadValorAlto(lead, config);

  let variante;
  let corpo;

  if (isPJ) {
    variante = 'PJ';
    corpo = `Recebi os dados da obra da sua empresa pelo site. Para obra feita em nome de empresa o caminho de redução é outro (contabilidade da obra, desoneração da folha, créditos abatíveis) e depende de cada empresa; é aí que o Gabriel atua. Está podendo me contar rapidinho como está a obra?`;
  } else if (gfipAnterior) {
    variante = 'Obra antes de 10/2021';
    corpo = `Recebi os dados ${obra} pelo site. Obra iniciada antes de 2021 tem um cálculo diferente, e podem existir pontos que mudam bastante o valor e que só aparecem numa análise cuidadosa. Esta é uma hora ruim para eu te perguntar sobre a obra?`;
  } else if (semCalculo) {
    variante = 'Sem estimativa automática';
    corpo = `Recebi os dados ${obra} pelo site, e o seu caso pede uma olhada mais cuidadosa. É isso que o Gabriel faz: entende a obra, aplica as reduções cabíveis e cuida de toda a regularização. Esta é uma hora ruim para eu entender melhor a sua obra?`;
  } else if (valorAlto) {
    variante = 'Valor alto';
    corpo = `Recebi os dados ${obra} pelo site, e ela merece uma olhada com cuidado. O Gabriel cuida de todo o processo para reduzir o INSS que a Receita cobraria da obra. Esta é uma hora ruim para eu te fazer umas perguntas rápidas sobre ela?`;
  } else {
    variante = 'Padrão';
    corpo = `Recebi os dados ${obra} pelo site. O Gabriel cuida de todo o processo para reduzir o INSS que a Receita cobraria da obra, do começo ao fim. Esta é uma hora ruim para eu te fazer umas perguntas rápidas sobre ela?`;
  }

  return { variante, texto: `${saudacao} ${comParcelamento(corpo)}` };
}
