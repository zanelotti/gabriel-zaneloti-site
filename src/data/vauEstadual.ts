/**
 * ============================================================================
 *  TABELA VAU ESTADUAL — Valor Atualizado Unitário (R$/m²), por estado e destinação
 * ============================================================================
 * O VAU é o índice oficial usado pela Receita Federal, na aferição indireta do
 * INSS de obra (Sero), para apurar o "Custo da obra por destinação" a partir da
 * área do projeto (IN RFB nº 2021/2021, arts. 15 a 18).
 *
 * FONTE: consulta direta a "Aferições → Consultar Tabela VAU" dentro do Sero,
 * no e-CAC (https://cav.receita.fazenda.gov.br) — é a MESMA tabela usada pela
 * Receita Federal no cálculo oficial, não uma estimativa por CUB/Sinduscon.
 * Valores conferidos para a competência indicada em VAU_COMPETENCIA, em
 * setembro/2026.
 *
 * COMO ATUALIZAR (todo mês, ou quando notar que os valores estão desatualizados):
 * 1. Entre no e-CAC (https://cav.receita.fazenda.gov.br) com sua conta gov.br.
 * 2. Vá em "Declarações e Demonstrativos" → "Acessar o Sero" → menu "Aferições"
 *    → "Consultar Tabela VAU".
 * 3. Escolha o Ano atual e cada Estado (UF), clique em "Buscar" — a tabela traz
 *    todos os meses do ano já publicados; use a linha do mês mais recente.
 * 4. Atualize os valores abaixo (e o VAU_COMPETENCIA) — não precisa mudar mais
 *    nada, o resto do sistema usa isso automaticamente.
 *
 * Mapeamento de colunas do Sero → campos abaixo:
 *   "Residencial unifamiliar"        → residencialUnifamiliar
 *   "Residencial multifamiliar"      → residencialMultifamiliar
 *   "Comercial salas e lojas"        → comercialSalasLojas
 *   "Galpão industrial"              → galpaoIndustrial
 *   "Conjunto habitacional popular"  → conjuntoHabitacionalPopular
 *   "Edifício de Garagens"           → edificioGaragens
 * (a coluna "Casa popular" do Sero não é usada — não há campo equivalente na
 * calculadora pública hoje.)
 * ============================================================================
 */

export interface VauDestinacoes {
  residencialUnifamiliar: number;
  residencialMultifamiliar: number;
  comercialSalasLojas: number;
  galpaoIndustrial: number;
  conjuntoHabitacionalPopular: number;
  edificioGaragens: number;
}

/** Competência (mês/ano) a que se referem os valores abaixo. */
export const VAU_COMPETENCIA = '2026-09';

export const VAU_ESTADUAL: Record<string, VauDestinacoes> = {
  AC: {
    residencialUnifamiliar: 4242.1,
    residencialMultifamiliar: 3585.47,
    comercialSalasLojas: 3970.6,
    galpaoIndustrial: 1835.61,
    conjuntoHabitacionalPopular: 2143.31,
    edificioGaragens: 3970.6,
  },
  AL: {
    residencialUnifamiliar: 2558.21,
    residencialMultifamiliar: 2204.66,
    comercialSalasLojas: 2466.05,
    galpaoIndustrial: 1151.86,
    conjuntoHabitacionalPopular: 1362.4,
    edificioGaragens: 2466.05,
  },
  AP: {
    residencialUnifamiliar: 3376.99,
    residencialMultifamiliar: 2982.56,
    comercialSalasLojas: 3386.0,
    galpaoIndustrial: 1609.56,
    conjuntoHabitacionalPopular: 1902.2,
    edificioGaragens: 3386.0,
  },
  AM: {
    residencialUnifamiliar: 4242.1,
    residencialMultifamiliar: 3585.47,
    comercialSalasLojas: 3970.6,
    galpaoIndustrial: 1835.61,
    conjuntoHabitacionalPopular: 2143.31,
    edificioGaragens: 3970.6,
  },
  BA: {
    residencialUnifamiliar: 2752.71,
    residencialMultifamiliar: 2307.07,
    comercialSalasLojas: 2642.31,
    galpaoIndustrial: 1198.83,
    conjuntoHabitacionalPopular: 1487.76,
    edificioGaragens: 2642.31,
  },
  CE: {
    residencialUnifamiliar: 2878.33,
    residencialMultifamiliar: 2499.51,
    comercialSalasLojas: 2845.05,
    galpaoIndustrial: 1347.8,
    conjuntoHabitacionalPopular: 1695.74,
    edificioGaragens: 2845.05,
  },
  DF: {
    residencialUnifamiliar: 2903.96,
    residencialMultifamiliar: 2516.31,
    comercialSalasLojas: 2879.66,
    galpaoIndustrial: 1287.94,
    conjuntoHabitacionalPopular: 1588.55,
    edificioGaragens: 2879.66,
  },
  ES: {
    residencialUnifamiliar: 3403.21,
    residencialMultifamiliar: 2895.38,
    comercialSalasLojas: 3226.46,
    galpaoIndustrial: 1462.06,
    conjuntoHabitacionalPopular: 1916.54,
    edificioGaragens: 3226.46,
  },
  GO: {
    residencialUnifamiliar: 2845.9,
    residencialMultifamiliar: 2376.01,
    comercialSalasLojas: 2704.95,
    galpaoIndustrial: 1264.09,
    conjuntoHabitacionalPopular: 1518.21,
    edificioGaragens: 2704.95,
  },
  MA: {
    residencialUnifamiliar: 2348.61,
    residencialMultifamiliar: 2246.52,
    comercialSalasLojas: 2294.07,
    galpaoIndustrial: 1094.67,
    conjuntoHabitacionalPopular: 1312.57,
    edificioGaragens: 2294.07,
  },
  MT: {
    residencialUnifamiliar: 4007.38,
    residencialMultifamiliar: 3482.69,
    comercialSalasLojas: 3957.52,
    galpaoIndustrial: 1740.33,
    conjuntoHabitacionalPopular: 2222.33,
    edificioGaragens: 3957.52,
  },
  MS: {
    residencialUnifamiliar: 2252.88,
    residencialMultifamiliar: 1887.01,
    comercialSalasLojas: 2345.43,
    galpaoIndustrial: 1057.28,
    conjuntoHabitacionalPopular: 1292.6,
    edificioGaragens: 2345.43,
  },
  MG: {
    residencialUnifamiliar: 3071.19,
    residencialMultifamiliar: 2664.4,
    comercialSalasLojas: 2991.56,
    galpaoIndustrial: 1316.03,
    conjuntoHabitacionalPopular: 1725.92,
    edificioGaragens: 2991.56,
  },
  PA: {
    residencialUnifamiliar: 2917.27,
    residencialMultifamiliar: 2548.39,
    comercialSalasLojas: 2869.22,
    galpaoIndustrial: 1356.84,
    conjuntoHabitacionalPopular: 1655.36,
    edificioGaragens: 2869.22,
  },
  PB: {
    residencialUnifamiliar: 2097.99,
    residencialMultifamiliar: 1859.16,
    comercialSalasLojas: 2089.85,
    galpaoIndustrial: 960.51,
    conjuntoHabitacionalPopular: 1135.38,
    edificioGaragens: 2089.85,
  },
  PR: {
    residencialUnifamiliar: 3340.01,
    residencialMultifamiliar: 2844.92,
    comercialSalasLojas: 3253.13,
    galpaoIndustrial: 1458.1,
    conjuntoHabitacionalPopular: 1827.31,
    edificioGaragens: 3253.13,
  },
  PE: {
    residencialUnifamiliar: 2799.33,
    residencialMultifamiliar: 2341.09,
    comercialSalasLojas: 2656.82,
    galpaoIndustrial: 1215.84,
    conjuntoHabitacionalPopular: 1553.08,
    edificioGaragens: 2656.82,
  },
  PI: {
    residencialUnifamiliar: 2348.61,
    residencialMultifamiliar: 2025.47,
    comercialSalasLojas: 2294.07,
    galpaoIndustrial: 1094.67,
    conjuntoHabitacionalPopular: 1312.57,
    edificioGaragens: 2294.07,
  },
  RJ: {
    residencialUnifamiliar: 3101.08,
    residencialMultifamiliar: 2669.62,
    comercialSalasLojas: 3036.43,
    galpaoIndustrial: 1378.73,
    conjuntoHabitacionalPopular: 1731.76,
    edificioGaragens: 3036.43,
  },
  RN: {
    residencialUnifamiliar: 2651.16,
    residencialMultifamiliar: 2276.11,
    comercialSalasLojas: 2532.87,
    galpaoIndustrial: 1217.66,
    conjuntoHabitacionalPopular: 1530.91,
    edificioGaragens: 2532.87,
  },
  RS: {
    residencialUnifamiliar: 3467.09,
    residencialMultifamiliar: 3069.41,
    comercialSalasLojas: 3639.91,
    galpaoIndustrial: 1412.37,
    conjuntoHabitacionalPopular: 1854.69,
    edificioGaragens: 3639.91,
  },
  RO: {
    residencialUnifamiliar: 2958.5,
    residencialMultifamiliar: 2692.13,
    comercialSalasLojas: 3044.81,
    galpaoIndustrial: 1357.59,
    conjuntoHabitacionalPopular: 1739.04,
    edificioGaragens: 3044.81,
  },
  RR: {
    residencialUnifamiliar: 3682.39,
    residencialMultifamiliar: 3156.13,
    comercialSalasLojas: 3595.77,
    galpaoIndustrial: 1723.59,
    conjuntoHabitacionalPopular: 1913.4,
    edificioGaragens: 3595.77,
  },
  SC: {
    residencialUnifamiliar: 3498.08,
    residencialMultifamiliar: 2968.24,
    comercialSalasLojas: 3410.76,
    galpaoIndustrial: 1577.81,
    conjuntoHabitacionalPopular: 1994.92,
    edificioGaragens: 3410.76,
  },
  SP: {
    residencialUnifamiliar: 2705.27,
    residencialMultifamiliar: 2359.48,
    comercialSalasLojas: 2685.96,
    galpaoIndustrial: 1265.41,
    conjuntoHabitacionalPopular: 1517.13,
    edificioGaragens: 2685.96,
  },
  SE: {
    residencialUnifamiliar: 2548.48,
    residencialMultifamiliar: 2308.47,
    comercialSalasLojas: 2585.44,
    galpaoIndustrial: 1188.74,
    conjuntoHabitacionalPopular: 1396.57,
    edificioGaragens: 2585.44,
  },
  TO: {
    residencialUnifamiliar: 2845.9,
    residencialMultifamiliar: 2376.01,
    comercialSalasLojas: 2704.95,
    galpaoIndustrial: 1264.09,
    conjuntoHabitacionalPopular: 1518.21,
    edificioGaragens: 2704.95,
  },
};
