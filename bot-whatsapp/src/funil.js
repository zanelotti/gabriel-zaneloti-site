/**
 * Regras de movimento dos cards no quadro (funil) do CRM.
 *
 * Colunas, nesta ordem:
 *   novo -> contatado -> (sem_resposta) -> proposta_enviada -> decidindo -> agendado -> fechado
 *   e, a qualquer momento, perdido.
 *
 * O bot só AVANÇA o card (nunca puxa para trás o que o Gabriel arrastou à mão) e
 * nunca mexe em card "fechado" ou "perdido". Exceções: "sem_resposta" é uma coluna
 * lateral (o lead volta para "contatado" assim que responde).
 */

export const STATUS_DO_BOT = ['contatado', 'sem_resposta', 'proposta_enviada', 'decidindo', 'agendado', 'perdido'];

const POSICAO = {
  novo: 0,
  contatado: 1,
  sem_resposta: 1,
  proposta_enviada: 2,
  decidindo: 3,
  agendado: 4,
  fechado: 5,
  perdido: 5,
};

/** Cards que o bot não mexe mais (decisão final do Gabriel ou do lead). */
export const STATUS_PROTEGIDOS = ['fechado', 'perdido'];

/** true se o bot pode mover o card de `atual` para `novo`. */
export function podeMover(atual, novo) {
  if (!novo || !(novo in POSICAO)) return false;
  const de = atual && atual in POSICAO ? atual : 'novo';
  if (de === novo) return false;
  if (STATUS_PROTEGIDOS.includes(de)) return false;
  if (novo === 'perdido') return true;
  if (novo === 'sem_resposta') return de === 'novo' || de === 'contatado';
  if (de === 'sem_resposta') return POSICAO[novo] >= 1;
  return POSICAO[novo] > POSICAO[de];
}

/**
 * A mensagem do bot apresentou os honorários? (cita "honorários" junto de um valor
 * em R$ ou de uma porcentagem). Nesse caso o card vai para "Proposta enviada".
 */
export function citouHonorarios(texto) {
  const t = String(texto || '');
  return /honor[aá]rio/i.test(t) && /R\$\s*\d|\d\s*%/.test(t);
}

/** Motivos de perda gravados no card (o CRM mostra o nome em português; ver MOTIVO_PERDA_LABEL no site). */
export const MOTIVOS_PERDA = ['preco', 'vai_fazer_sozinho', 'desconfianca', 'ja_resolveu', 'sem_resposta', 'sem_interesse', 'pediu_para_parar', 'outro'];

/**
 * O que acontece com o card quando a consultoria gratuita (tabela agendamentos) muda de situação.
 * Devolve null (não mexer) ou { status, nota, regredirDe?, avisar? }.
 *  - agendada  -> "Agendamento"
 *  - realizada -> "Decidindo" (se o card ainda estava em "Agendamento", pode voltar uma coluna)
 *  - faltou    -> "Contatado", só se o card ainda estava em "Agendamento" (nunca desfaz o que o Gabriel arrastou à mão) + aviso por e-mail
 */
export function movimentoDaConsultoria(statusConsultoria, statusCard) {
  if (STATUS_PROTEGIDOS.includes(statusCard)) return null;
  if (statusConsultoria === 'agendado') return { status: 'agendado', nota: 'Consultoria gratuita agendada.' };
  if (statusConsultoria === 'realizado') return { status: 'decidindo', regredirDe: 'agendado', nota: 'Consultoria realizada.' };
  if (statusConsultoria === 'nao_compareceu') {
    return statusCard === 'agendado' ? { status: 'contatado', regredirDe: 'agendado', nota: 'Lead não compareceu à consultoria.', avisar: true } : null;
  }
  return null;
}

/** O lead mandou arquivo que o bot não lê (documento ou foto)? Vale como interesse real: o card avança para "Decidindo". */
export function ehDocumentoDoLead(tipo) {
  return tipo === 'documento' || tipo === 'imagem';
}
