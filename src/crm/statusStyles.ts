import type { LeadStatus } from '@/types/lead';

/**
 * Cor de cada etapa do funil. As etapas em progressão (novo -> decidindo)
 * usam uma rampa sequencial de um único tom (navy, do mais claro ao mais
 * escuro) — a cor cresce junto com o avanço do lead no funil. As 2 etapas
 * terminais usam cores de status (verde = sucesso, vermelho = perda), já
 * que não fazem parte da progressão. `sem_resposta` usa cinza neutro, por
 * ser uma coluna "de espera" fora do funil principal (não é perda nem avanço).
 */
export const STATUS_STYLES: Record<LeadStatus, { bg: string; text: string; dot: string }> = {
  novo: { bg: 'bg-navy-100', text: 'text-navy-700', dot: 'bg-navy-300' },
  contatado: { bg: 'bg-navy-200', text: 'text-navy-800', dot: 'bg-navy-500' },
  sem_resposta: { bg: 'bg-slate-200', text: 'text-slate-700', dot: 'bg-slate-400' },
  proposta_enviada: { bg: 'bg-navy-300', text: 'text-navy-900', dot: 'bg-navy-700' },
  decidindo: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
  fechado: { bg: 'bg-accent-100', text: 'text-accent-800', dot: 'bg-accent-500' },
  perdido: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
};
