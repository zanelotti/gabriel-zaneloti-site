import type {
  CategoriaObra,
  Destinacao,
  INSSDetalheInterno,
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
}

/** Dados necessários para criar um novo lead (tudo, exceto id/createdAt, gerados pelo serviço). */
export type NewLeadInput = Omit<Lead, 'id' | 'createdAt'>;
