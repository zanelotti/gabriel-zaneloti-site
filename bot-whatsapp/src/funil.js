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
