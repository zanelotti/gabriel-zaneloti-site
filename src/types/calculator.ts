import type { FatorAjusteMonthRow, ParcelamentoEstimado } from './fatorAjuste';

/**
 * Tipos relacionados ao formulário/estado da calculadora de simulação de INSS de obra.
 */

export type Responsavel = 'PF' | 'PJ' | '';

export type TipoObra = 'alvenaria' | 'madeira' | 'mista' | '';

/** Categoria da obra, conforme IN RFB nº 2021/2021 — define o "percentual de cálculo por categoria" (art. 19.2). */
export type CategoriaObra = 'obra_nova' | 'acrescimo' | 'reforma' | 'demolicao' | '';

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
  categoria: CategoriaObra;
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
  categoria: '',
  estado: '',
  destinacao: '',
  areaPrincipal: null,
  areaPiscina: null,
  observacoes: '',
};

/**
 * Detalhamento interno do cálculo (linha a linha, honorários, parcelamento etc.).
 * Usado SOMENTE no e-mail de notificação que o Gabriel recebe por trás dos
 * bastidores — nunca é exibido na UI pública da calculadora (o `ResultCard`
 * não lê este campo, só os 4 números-resumo do `INSSResult`).
 */
export interface INSSDetalheInterno {
  rmt100: number;
  percentualFator: 50 | 70;
  areaM2: number;
  numeroMeses: number;
  linhasComFator: FatorAjusteMonthRow[];
  /** Honorários = 12% da economia estimada (regra padrão para leads do simulador público). */
  honorarios: number;
  reducaoLiquida: number;
  parcelamento: ParcelamentoEstimado;
}

/** Resultado retornado pelo motor de cálculo (calculateINSS). */
export interface INSSResult {
  inssEstimado: number;
  economiaEstimada: number;
  percentualReducao: number;
  valorAposReducao: number;
  mensagem: string;
  /** Sinaliza que este resultado vem de um motor provisório/mock — não é um cálculo tributário oficial. */
  isEstimativaProvisoria: true;
  /**
   * Detalhamento interno (uso exclusivo do Gabriel, via e-mail) — ausente
   * quando o resultado vem do caminho de segurança (`resultadoSeguro`).
   */
  detalheInterno?: INSSDetalheInterno;
}

export type CalculatorStepIndex = 1 | 2 | 3;

/** Mapa de erros de validação por campo, usado nas etapas do formulário. */
export type FormErrors<T> = Partial<Record<keyof T, string>>;
