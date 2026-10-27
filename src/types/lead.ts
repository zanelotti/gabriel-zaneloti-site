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
 * novo -> contatado -> sem_resposta | proposta_enviada -> decidindo -> agendado -> fechado | perdido.
 * `sem_resposta` é uma coluna "de espera", separada do funil principal, para
 * leads contatados que não respondem no WhatsApp — não significa perdido.
 * `agendado` (coluna "Agendamento") recebe os leads que marcaram a consultoria
 * — o bot do WhatsApp move o card para lá sozinho quando agenda.
 */
export type LeadStatus =
  | 'novo'
  | 'contatado'
  | 'sem_resposta'
  | 'proposta_enviada'
  | 'decidindo'
  | 'agendado'
  | 'fechado'
  | 'perdido';

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'novo',
  'contatado',
  'sem_resposta',
  'proposta_enviada',
  'decidindo',
  'agendado',
  'fechado',
  'perdido',
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  sem_resposta: 'Sem resposta',
  proposta_enviada: 'Proposta enviada',
  decidindo: 'Decidindo',
  agendado: 'Agendamento',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

/**
 * Por que um lead foi perdido. O bot preenche sozinho quando sabe (pediu para parar, achou caro...)
 * e o Gabriel pode escolher/corrigir no card. Serve para ver onde o funil vaza.
 */
export type MotivoPerda =
  | 'preco'
  | 'vai_fazer_sozinho'
  | 'desconfianca'
  | 'ja_resolveu'
  | 'sem_resposta'
  | 'sem_interesse'
  | 'pediu_para_parar'
  | 'outro';

export const MOTIVO_PERDA_ORDER: MotivoPerda[] = [
  'preco',
  'vai_fazer_sozinho',
  'desconfianca',
  'ja_resolveu',
  'sem_resposta',
  'sem_interesse',
  'pediu_para_parar',
  'outro',
];

export const MOTIVO_PERDA_LABEL: Record<MotivoPerda, string> = {
  preco: 'Achou caro',
  vai_fazer_sozinho: 'Vai fazer sozinho',
  desconfianca: 'Desconfiança',
  ja_resolveu: 'Já resolveu (outro profissional)',
  sem_resposta: 'Sumiu (sem resposta)',
  sem_interesse: 'Sem interesse',
  pediu_para_parar: 'Pediu para parar',
  outro: 'Outro',
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
  /** Código do parceiro que indicou este lead (vem do link `?ref=` do programa de parceiros). */
  parceiroRef?: string;

  // --------------------------------------------------------------------
  // Campos do CRM (só existem nos leads vindos do Supabase — a captura
  // pública não os define, ficam com o default do banco: status 'novo').
  // --------------------------------------------------------------------
  status?: LeadStatus;
  notas?: string | null;
  valorFechado?: number | null;
  /** Honorários efetivamente cobrados do cliente nesse lead (uso interno, nunca exibido ao cliente). */
  honorarios?: number | null;
  /** Só faz sentido quando status = 'perdido'. */
  motivoPerda?: MotivoPerda | null;
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

/** Situação de uma consultoria gratuita agendada pelo site. */
export type AgendamentoStatus = 'agendado' | 'realizado' | 'nao_compareceu' | 'cancelado';

export const AGENDAMENTO_STATUS_ORDER: AgendamentoStatus[] = [
  'agendado',
  'realizado',
  'nao_compareceu',
  'cancelado',
];

export const AGENDAMENTO_STATUS_LABEL: Record<AgendamentoStatus, string> = {
  agendado: 'Agendado',
  realizado: 'Realizado',
  nao_compareceu: 'Não compareceu',
  cancelado: 'Cancelado',
};

/**
 * Consultoria gratuita agendada pelo site (tabela `agendamentos`). Além do
 * contato, guarda a origem do clique (gclid/gbraid/wbraid e UTMs) para uso no
 * Google Ads — aba "Agenda" do CRM.
 */
export interface Agendamento {
  id: string;
  nome: string;
  email: string;
  /** Somente dígitos, com DDD (sem o +55). */
  whatsapp: string;
  inicio: string;
  fim: string;
  observacoes: string;
  status: AgendamentoStatus;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  landingPage: string | null;
  googleEventLink: string | null;
  createdAt: string;
}
