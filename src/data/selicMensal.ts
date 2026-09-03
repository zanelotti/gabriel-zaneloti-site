/**
 * ============================================================================
 *  TABELA DA TAXA SELIC MENSAL — para cálculo de juros de mora (Art. 31, IN RFB nº 2021/2021)
 * ============================================================================
 * Cada entrada é a taxa Selic do PRÓPRIO mês (não acumulada), no formato usado
 * pela Receita Federal para atualização de débitos tributários. A mesma tabela
 * que você consulta hoje (ex: Sicalc da Receita, ou os quadros publicados por
 * sites de contabilidade) — os valores abaixo foram conferidos batendo
 * exatamente com o exemplo real que você me enviou (competência 10/2021,
 * "Data realizada" 08/2026 → 57,53% acumulado, idêntico ao seu relatório).
 *
 * COMO ATUALIZAR TODO MÊS:
 * Assim que a Receita/Bacen divulgar a taxa Selic do mês, adicione UMA linha
 * no final do objeto abaixo, no formato "AAAA-MM": taxa_do_mês_em_percentual.
 * Não é preciso recalcular nada — o resto do sistema usa isso automaticamente.
 *
 * Exemplo: se a Selic de outubro/2026 for divulgada como 1,05%, adicione:
 *   '2026-10': 1.05,
 *
 * Fonte original destes valores: séries públicas de taxa Selic mensal
 * (Banco Central / Receita Federal), consolidadas em set/2026.
 * ============================================================================
 */

export const SELIC_MENSAL: Record<string, number> = {
  '2021-01': 0.15,
  '2021-02': 0.13,
  '2021-03': 0.2,
  '2021-04': 0.21,
  '2021-05': 0.27,
  '2021-06': 0.31,
  '2021-07': 0.36,
  '2021-08': 0.43,
  '2021-09': 0.44,
  '2021-10': 0.49,
  '2021-11': 0.59,
  '2021-12': 0.77,
  '2022-01': 0.73,
  '2022-02': 0.76,
  '2022-03': 0.93,
  '2022-04': 0.83,
  '2022-05': 1.03,
  '2022-06': 1.02,
  '2022-07': 1.03,
  '2022-08': 1.17,
  '2022-09': 1.07,
  '2022-10': 1.02,
  '2022-11': 1.02,
  '2022-12': 1.12,
  '2023-01': 1.12,
  '2023-02': 0.92,
  '2023-03': 1.17,
  '2023-04': 0.92,
  '2023-05': 1.12,
  '2023-06': 1.07,
  '2023-07': 1.07,
  '2023-08': 1.14,
  '2023-09': 0.97,
  '2023-10': 1.0,
  '2023-11': 0.92,
  '2023-12': 0.89,
  '2024-01': 0.97,
  '2024-02': 0.8,
  '2024-03': 0.83,
  '2024-04': 0.89,
  '2024-05': 0.83,
  '2024-06': 0.79,
  '2024-07': 0.91,
  '2024-08': 0.87,
  '2024-09': 0.84,
  '2024-10': 0.93,
  '2024-11': 0.79,
  '2024-12': 0.93,
  '2025-01': 1.01,
  '2025-02': 0.99,
  '2025-03': 0.96,
  '2025-04': 1.06,
  '2025-05': 1.14,
  '2025-06': 1.1,
  '2025-07': 1.28,
  '2025-08': 1.16,
  '2025-09': 1.22,
  '2025-10': 1.28,
  '2025-11': 1.05,
  '2025-12': 1.22,
  '2026-01': 1.16,
  '2026-02': 1.0,
  '2026-03': 1.21,
  '2026-04': 1.09,
  '2026-05': 1.07,
  '2026-06': 1.12,
  '2026-07': 1.22,
  '2026-08': 1.09,
};

/** Formata um Date (ou "AAAA-MM") como chave "AAAA-MM" usada na tabela acima. */
export function toCompetenciaKey(input: string | Date): string {
  if (input instanceof Date) {
    const year = input.getFullYear();
    const month = String(input.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  // Aceita "AAAA-MM" diretamente, ou "AAAA-MM-DD" (de um <input type="date">).
  return input.slice(0, 7);
}

/** Soma 1 mês a uma chave de competência "AAAA-MM". */
export function addMonths(key: string, months: number): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return toCompetenciaKey(date);
}

/** Compara duas chaves de competência "AAAA-MM" (-1, 0, 1). */
export function compareCompetencia(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Calcula a taxa Selic acumulada para uma competência, nos termos do Art. 31
 * da IN RFB nº 2021/2021: soma das taxas mensais a partir do 2º mês
 * subsequente à competência até o mês anterior ao mês de referência
 * (transmissão/apuração), acrescida de 1% fixo no mês de referência.
 *
 * @param competencia  Mês/ano a que se refere a remuneração ("AAAA-MM")
 * @param referencia   Mês/ano da apuração/"data realizada" ("AAAA-MM")
 */
export function calcularSelicAcumulada(competencia: string, referencia: string): number {
  const inicioSoma = addMonths(competencia, 2);
  const fimSoma = addMonths(referencia, -1);

  let acumulado = 0;
  let cursor = inicioSoma;

  // Se a competência for muito recente (menos de 2 meses antes da referência),
  // não há meses a somar — só o 1% fixo do mês de referência.
  while (compareCompetencia(cursor, fimSoma) <= 0) {
    const taxa = SELIC_MENSAL[cursor];
    if (taxa === undefined) {
      throw new Error(
        `Taxa Selic não encontrada para a competência ${cursor}. Atualize src/data/selicMensal.ts com o valor desse mês.`
      );
    }
    acumulado += taxa;
    cursor = addMonths(cursor, 1);
  }

  return Number((acumulado + 1).toFixed(2));
}
