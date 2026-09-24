import type {
  CategoriaObra,
  Destinacao,
  INSSDetalheInterno,
  Responsavel,
  SituacaoObra,
  TipoObra,
} from './calculator';

/**
 * Etapas do funil de acompanhamento comercial (CRM), nesta ordem:
 * novo -> contatado -> sem_resposta | proposta_enviada -> decidindo -> fechado | perdido.
 * `sem_resposta` é uma coluna "de espera", separada do funil principal, para
 * leads contatados que não respondem no WhatsApp — não significa perdido.
 */
export type LeadStatus =
  | 'novo'
  | 'contatado'
  | 'sem_resposta'
  | 'proposta_enviada'
  | 'decidindo'
  | 'fechado'
  | 'perdido';

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'novo',
  'contatado',
  'sem_resposta',
  'proposta_enviada',
  'decidindo',
  'fechado',
  'perdido',
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  sem_resposta: 'Sem resposta',
  proposta_enviada: 'Proposta enviada',
  decidindo: 'Decidindo',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

/**
 * Representa um lead gerado a partir de uma simulação concluída na calculadora.
 * Esta interface é o contrato usado pela camada `leadService`, independentemente
 * de onde os leads acabem sendo persistidos (localStorage, Supabase, API própria, CRM...).
 */
export interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  dataInicio: string;
  dataFim: string;
  responsavel: Responsavel;
  tipoObra: TipoObra;
  situacao: SituacaoObra;
  categoria: CategoriaObra;
  estado: string;
  destinacao: Destinacao;
  areaPrincipal: number | null;
  areaPiscina: number | null;
  observacoes: string;
  /** null quando não foi possível gerar a estimativa automática para os dados informados. */
  inssEstimado: number | null;
  economiaEstimada: number | null;
  percentualReducao: number | null;
  valorAposReducao: number | null;
  /**
   * Detalhamento interno do cálculo (linhas mensais, honorários 12%, redução
   * líquida etc.) — usado só no e-mail de notificação do Gabriel, nunca
   * exibido na UI pública. null quando não foi possível gerar a estimativa.
   */
  detalheInterno: INSSDetalheInterno | null;
  createdAt: string;

  // --------------------------------------------------------------------
  // Campos do CRM (só existem nos leads vindos do Supabase — a captura
  // pública não os define, ficam com o default do banco: status 'novo').
  // --------------------------------------------------------------------
  status?: LeadStatus;
  notas?: string | null;
  valorFechado?: number | null;
  /** Honorários efetivamente cobrados do cliente nesse lead (uso interno, nunca exibido ao cliente). */
  honorarios?: number | null;
  updatedAt?: string;
}

/** Dados necessários para criar um novo lead (tudo, exceto id/createdAt, gerados pelo serviço). */
export type NewLeadInput = Omit<Lead, 'id' | 'createdAt'>;

/**
 * Representa um contato que baixou algum guia gratuito em PDF (tabela
 * `guia_leads`, separada de `leads` — ainda não é uma simulação completa).
 * Usado na aba "Guia" do CRM, principalmente para exportar nome + e-mail
 * para campanhas de remarketing (Meta Ads / Google Ads).
 */
export interface GuiaLead {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  material: string;
  createdAt: string;
}
