/**
 * Tipos relacionados ao formulário/estado da calculadora de simulação de INSS de obra.
 */

export type Responsavel = 'PF' | 'PJ' | '';

export type TipoObra = 'alvenaria' | 'madeira' | 'mista' | '';

export type SituacaoObra =
  | 'concluida_com_habite_se'
  | 'concluida_sem_habite_se'
  | 'em_construcao'
  | 'iniciar_em_breve'
  | 'construida_ha_mais_de_5_anos'
  | '';

export type Destinacao =
  | 'residencial_unifamiliar'
  | 'multifamiliar'
  | 'comercial_salas_lojas'
  | 'galpao_industrial'
  | 'conjunto_habitacional'
  | 'edificio_garagem'
  | '';

/** Estado único para todos os dados coletados ao longo das 3 etapas da calculadora. */
export interface CalculatorData {
  // Etapa 1 — Dados do cliente
  nome: string;
  whatsapp: string;

  // Etapa 2 — Dados da obra
  dataInicio: string;
  dataFim: string;
  responsavel: Responsavel;
  tipoObra: TipoObra;
  situacao: SituacaoObra;
  estado: string;
  destinacao: Destinacao;

  // Etapa 3 — Áreas e observações
  areaPrincipal: number | null;
  areaPiscina: number | null;
  observacoes: string;
}

export const INITIAL_CALCULATOR_DATA: CalculatorData = {
  nome: '',
  whatsapp: '',
  dataInicio: '',
  dataFim: '',
  responsavel: '',
  tipoObra: '',
  situacao: '',
  estado: '',
  destinacao: '',
  areaPrincipal: null,
  areaPiscina: null,
  observacoes: '',
};

/** Resultado retornado pelo motor de cálculo (calculateINSS). */
export interface INSSResult {
  inssEstimado: number;
  economiaEstimada: number;
  percentualReducao: number;
  valorAposReducao: number;
  mensagem: string;
  /** Sinaliza que este resultado vem de um motor provisório/mock — não é um cálculo tributário oficial. */
  isEstimativaProvisoria: true;
}

export type CalculatorStepIndex = 1 | 2 | 3;

/** Mapa de erros de validação por campo, usado nas etapas do formulário. */
export type FormErrors<T> = Partial<Record<keyof T, string>>;
