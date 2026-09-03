import type {
  Destinacao,
  Responsavel,
  SituacaoObra,
  TipoObra,
} from './calculator';

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
  estado: string;
  destinacao: Destinacao;
  areaPrincipal: number | null;
  areaPiscina: number | null;
  observacoes: string;
  inssEstimado: number;
  economiaEstimada: number;
  percentualReducao: number;
  valorAposReducao: number;
  createdAt: string;
}

/** Dados necessários para criar um novo lead (tudo, exceto id/createdAt, gerados pelo serviço). */
export type NewLeadInput = Omit<Lead, 'id' | 'createdAt'>;
