/**
 * Tipos do motor de cálculo do Planejamento Tributário de INSS de Obra
 * (réplica do processo mensal descrito na IN RFB nº 2021/2021, art. 24-33).
 *
 * Esta calculadora é uma ferramenta INTERNA (uso do Gabriel), separada da
 * simulação pública do site. A RMT (100% SERO) é informada manualmente,
 * pois depende das tabelas CUB/VAU (Sinduscon), que variam por estado e mês
 * e não são calculadas automaticamente aqui.
 */

export type ResponsavelObra = 'PF' | 'PJ';

export interface FatorAjusteInput {
  /** RMT apurada a 100% (SERO), em R$ — calculada externamente pelo Gabriel. */
  rmt100: number;
  /** Área total da obra, em m² — define o percentual do Fator de Ajuste (50% até 350m², 70% acima). */
  areaM2: number;
  /** Competência de início da obra/DCTFWeb, formato "AAAA-MM-DD" (de um input type=date). */
  dataInicio: string;
  /** Competência de fim da obra/DCTFWeb, formato "AAAA-MM-DD". */
  dataFim: string;
  /** Responsável pela obra — define o valor mínimo de parcela (PF: R$200, PJ: R$500). */
  responsavel: ResponsavelObra;
  /** Data em que o cálculo é realizado (mês de referência/transmissão), "AAAA-MM-DD". Padrão: hoje. */
  dataCalculo: string;
  /** Honorários (R$), opcional — informado manualmente, não calculado. */
  honorarios: number | null;
}

/** Uma linha da tabela mensal (mês/ano, REM.ATUAL, REM.ORIG, CPP, MULTA, SELIC, MORA, MAED, TOTAL). */
export interface FatorAjusteMonthRow {
  competencia: string; // "AAAA-MM"
  remAtual: number;
  remOrig: number;
  cpp: number;
  multaPct: number;
  multa: number;
  selicPct: number;
  mora: number;
  maed: number;
  total: number;
}

export interface ParcelamentoEstimado {
  parcelaMinima: number;
  numeroParcelas: number;
  valorParcela: number;
}

export interface FatorAjusteResult {
  areaM2: number;
  rmt100: number;
  percentualFator: 50 | 70;
  rmtAjustada: number;
  numeroMeses: number;
  linhasComFator: FatorAjusteMonthRow[];
  totalComFator: number;
  /** RMT (100%) × 36,8% — taxa de referência fixa para obras sem o benefício do Fator de Ajuste. */
  totalSemFator: number;
  reducao: number;
  reducaoPercentual: number;
  honorarios: number | null;
  reducaoLiquida: number | null;
  parcelamento: ParcelamentoEstimado;
}
