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
 * novo -> contatado -> proposta_enviada -> decidindo -> fechado | perdido.
 */
export type LeadStatus = 'novo' | 'contatado' | 'proposta_enviada' | 'decidindo' | 'fechado' | 'perdido';

/**
 * Estados da conversa do SDR automatizado (piloto). Ver SDR_PLAYBOOK.md na
 * raiz do projeto para o significado e o fluxo completo de cada um.
 */
export type SdrEstado =
  | 'novo'
  | 'aguardando_lead'
  | 'follow_up_agendado'
  | 'aguardando_gabriel'
  | 'retomado_pos_honorarios'
  | 'fechado'
  | 'perdido'
  | 'pausado';

export const SDR_ESTADO_LABEL: Record<SdrEstado, string> = {
  novo: 'Aguardando 1º contato',
  aguardando_lead: 'Aguardando resposta do lead',
  follow_up_agendado: 'Follow-up agendado',
  aguardando_gabriel: 'Aguardando você informar os honorários',
  retomado_pos_honorarios: 'Retomado — fechando',
  fechado: 'Fechado pelo SDR',
  perdido: 'Perdido',
  pausado: 'Pausado manualmente',
};

/** Uma mensagem no histórico da conversa do SDR. */
export interface SdrHistoricoEntry {
  em: string;
  de: 'bot' | 'lead' | 'gabriel' | 'sistema';
  texto: string;
}

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'novo',
  'contatado',
  'proposta_enviada',
  'decidindo',
  'fechado',
  'perdido',
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
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

  // --------------------------------------------------------------------
  // SDR automatizado (piloto) — acompanhamento ativo via WhatsApp.
  // --------------------------------------------------------------------
  /** Se o SDR está autorizado a conversar com esse lead (hoje: só leads de teste). */
  sdrAtivo?: boolean;
  sdrEstado?: SdrEstado;
  /** Data combinada para o próximo follow-up (quando o lead disse "me chama dia X"). */
  sdrProximoContato?: string | null;
  sdrHistorico?: SdrHistoricoEntry[];
}

/** Dados necessários para criar um novo lead (tudo, exceto id/createdAt, gerados pelo serviço). */
export type NewLeadInput = Omit<Lead, 'id' | 'createdAt'>;
