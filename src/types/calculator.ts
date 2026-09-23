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
  /** Confirmação de leitura/aceite da Política de Privacidade — exigida para enviar a simulação (LGPD). */
  aceitaTermos: boolean;
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
  aceitaTermos: false,
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
  /**
   * Presente apenas quando `regimeApuracao === 'esocial_ajustado'`: a
   * competência ("AAAA-MM-DD") efetivamente usada no cálculo (10/2021), para
   * que o e-mail interno deixe claro que a data de início real foi deslocada.
   */
  dataInicioAjustada?: string;
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
  /** Regime de apuração aplicável, conforme a data real de início da obra (eSocial x GFIP). */
  regimeApuracao: RegimeApuracao;
  /**
   * Detalhamento interno (uso exclusivo do Gabriel, via e-mail) — ausente
   * quando o resultado vem do caminho de segurança (`resultadoSeguro`).
   */
  detalheInterno?: INSSDetalheInterno;
  /**
   * Parcelamento estimado do saldo em atraso — DIFERENTE de `detalheInterno`,
   * este campo é seguro e pensado para ser exibido ao cliente (ResultCard e
   * PDF público): não contém honorários nem o detalhamento mês a mês, só
   * parcela mínima (R$200 PF / R$500 PJ), quantidade de parcelas (máx. 60) e
   * valor de cada uma. Ausente quando não há saldo em atraso a parcelar, ou
   * quando o Fator de Ajuste não se aplica (PJ) / o caso exige análise manual
   * (obra iniciada antes de 10/2021).
   */
  parcelamento?: ParcelamentoEstimado;
}

/**
 * Regime de apuração aplicável conforme a DATA REAL de início da obra —
 * eSocial só passou a ser obrigatório para obras a partir da competência
 * 10/2021; antes disso, a apuração era feita pelo GFIP:
 *  - 'esocial'            → obra iniciada em 10/2021 ou depois (fluxo normal).
 *  - 'esocial_ajustado'   → obra iniciada entre 01/2021 e 09/2021: o cálculo é
 *    deslocado internamente para a competência 10/2021 (prática do Gabriel
 *    para poder tramitar tudo já pelo eSocial), mas a data real de início
 *    continua sendo a informada pelo cliente (usada no resumo/CRM/e-mail).
 *  - 'gfip_anterior_2021' → obra iniciada em 2020 ou antes: apuração pelo
 *    GFIP, mais complexa e sujeita a decadência caso a caso — não é exibido
 *    cálculo automático de redução para o visitante, só o valor devido e um
 *    convite para falar direto com o Gabriel.
 */
export type RegimeApuracao = 'esocial' | 'esocial_ajustado' | 'gfip_anterior_2021';

export type CalculatorStepIndex = 1 | 2 | 3;

/** Mapa de erros de validação por campo, usado nas etapas do formulário. */
export type FormErrors<T> = Partial<Record<keyof T, string>>;
