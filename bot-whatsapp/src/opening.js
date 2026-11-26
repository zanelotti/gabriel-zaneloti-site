/**
 * Primeira mensagem enviada ao lead (a mesma lógica do aviso por e-mail do site,
 * em notify-lead.js), com uma diferença deliberada: o bot se apresenta pelo nome
 * (ASSISTENTE_NOME) como assistente do Gabriel, e não como se fosse o próprio Gabriel.
 *
 * IMPORTANTE: o site NÃO mostra mais o resultado do cálculo ao visitante. Por isso a abertura NÃO cita nenhum valor
 * (INSS, economia, honorário): ela só confirma a metragem e o prazo da obra. Os números aparecem depois, na simulação enviada na conversa.
 *
 * Regras de conteúdo (alinhadas com o Gabriel): nada de "só paga se economizar",
 * sem mencionar honorários na abertura, e sem as palavras "legal", "direito" ou "advogado"
 * (nem "jurídico" fora de "pessoa jurídica").
 */
import { montarAberturaEbook, ehLeadExterno } from './origem.js';
import { formatarArea, leadValorAlto, primeiroNomePessoa, regimeApuracao } from './util.js';

/** "2023-03-01" -> "03/2023" */
function mesAno(iso) {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[2]}/${m[1]}` : '';
}

/** Pergunta de confirmação da metragem e do prazo da obra (o papel do bot é só confirmar os dados básicos e passar a simulação). */
function pedidoDeConfirmacao(lead) {
  const area = Number(lead.area_principal) + (Number(lead.area_piscina) > 0 ? Number(lead.area_piscina) : 0);
  const inicio = mesAno(lead.data_inicio);
  const fim = mesAno(lead.data_fim);
  if (Number.isFinite(area) && area > 0 && inicio) {
    return `Só para confirmar: a obra tem ${formatarArea(area)}, com início em ${inicio} ${fim ? `e término em ${fim}` : 'e ainda em andamento'}. Está certo?`;
  }
  return 'Para fazer a sua simulação, me confirma a metragem da obra e o prazo (mês e ano de início e de término)?';
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
    corpo = `Recebi os dados da obra da sua empresa pelo site. Para obra em nome de empresa o caminho de redução é outro, e eu te explico como funciona. ${pedidoDeConfirmacao(lead)}`;
  } else if (gfipAnterior) {
    variante = 'Obra antes de 10/2021';
    corpo = `Recebi os dados ${obra} pelo site. Obra iniciada antes de 2021 tem um cálculo diferente, com regras próprias de redução. ${pedidoDeConfirmacao(lead)}`;
  } else if (semCalculo) {
    variante = 'Sem estimativa automática';
    corpo = `Recebi os dados ${obra} pelo site e vou preparar a sua simulação. ${pedidoDeConfirmacao(lead)}`;
  } else if (valorAlto) {
    variante = 'Valor alto';
    corpo = `Recebi os dados da sua obra pelo site e vou preparar a sua simulação. ${pedidoDeConfirmacao(lead)}`;
  } else {
    variante = 'Padrão';
    corpo = `Recebi os dados da sua obra pelo site e vou preparar a sua simulação. ${pedidoDeConfirmacao(lead)}`;
  }

  return { variante, texto: `${saudacao} ${corpo}` };
}
