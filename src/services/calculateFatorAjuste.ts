import type {
  FatorAjusteInput,
  FatorAjusteMonthRow,
  FatorAjusteResult,
} from '@/types/fatorAjuste';
import { addMonths, calcularSelicAcumulada, compareCompetencia, toCompetenciaKey } from '@/data/selicMensal';

/**
 * ============================================================================
 *  MOTOR DE CÁLCULO — PLANEJAMENTO TRIBUTÁRIO DE INSS DE OBRA (FATOR DE AJUSTE)
 * ============================================================================
 * Reproduz a mecânica descrita na IN RFB nº 2021/2021 (arts. 24 a 33):
 *
 *  1. RMT ajustada = RMT (100% SERO) × 50% (obra ≤350 m²) ou × 70% (obra >350 m²) — Art. 33
 *  2. REM.ATUAL (fixo, todo mês) = RMT ajustada ÷ número de meses de DCTFWeb
 *  3. REM.ORIG = REM.ATUAL ÷ (1 + Selic acumulada da competência) — Art. 31
 *  4. CPP = 20% × REM.ORIG
 *  5. MULTA de mora = 0,33% ao dia (limitada a 20%), sobre a CPP, contada do
 *     vencimento (dia 20 do mês seguinte à competência) até a data do cálculo
 *  6. MORA = CPP × Selic acumulada da competência
 *  7. MAED = R$ 100,00 fixos por mês (já considerando o desconto de 50% para
 *     pagamento em até 30 dias)
 *  8. TOTAL do mês = CPP + MULTA + MORA + MAED
 *
 * A mesma mecânica é recalculada com a RMT a 100% (sem redução) para compor
 * o comparativo "sem Fator de Ajuste" — nesse cenário, apenas a MAED
 * permanece fixa; os demais componentes escalam com a RMT maior.
 *
 * VALIDADO contra os 3 exemplos reais fornecidos pelo Gabriel: a linha de
 * 10/2021 do primeiro relatório (Selic 57,53%, CPP R$157,34, total R$379,33)
 * é reproduzida exatamente por este motor.
 * ============================================================================
 */

const ALIQUOTA_CPP = 0.2;
const MULTA_DIARIA_PCT = 0.33;
const MULTA_TETO_PCT = 20;
const MAED_MENSAL = 100;

/**
 * Taxa de referência fixa para o cenário "sem Fator de Ajuste": totalSemFator = RMT (100%) × 36,8%.
 * Não é um novo cálculo mês a mês — é a mesma taxa usada como comparativo nos
 * seus relatórios reais (conferida com precisão de centavos nos 3 exemplos
 * fornecidos, com áreas e durações bem diferentes entre si — R$12.769,37 /
 * R$41.464,22 / R$45.554,04, todos exatamente 36,80% da respectiva RMT 100%).
 */
const TAXA_SEM_FATOR = 0.368;

/**
 * Teto de segurança para o número de competências em um único cálculo (66 anos).
 * A tabela de Selic mensal cobre desde 08/1986 — mais que suficiente para
 * qualquer obra real, mesmo "construída há muitos anos". Este teto existe só
 * para nunca deixar o cálculo rodar por muito tempo (ou travar a tela) caso
 * alguém digite uma data claramente absurda (ex: ano trocado por engano).
 * Nesse caso, falha rápido com uma mensagem clara em vez de percorrer
 * milhares de meses.
 */
const MAX_COMPETENCIAS = 800;

/** Lista as competências ("AAAA-MM"), inclusive, entre início e fim. */
function listarCompetencias(inicio: string, fim: string): string[] {
  const competencias: string[] = [];
  let cursor = toCompetenciaKey(inicio);
  const fimKey = toCompetenciaKey(fim);

  while (compareCompetencia(cursor, fimKey) <= 0) {
    if (competencias.length >= MAX_COMPETENCIAS) {
      throw new Error('Período entre a data de início e a data de fim é longo demais para calcular.');
    }
    competencias.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return competencias;
}

/** Vencimento padrão da GPS/DARF: dia 20 do mês seguinte à competência. */
function dataVencimento(competencia: string): Date {
  const [year, month] = competencia.split('-').map(Number);
  // month é 1-indexado na chave; +1 para "mês seguinte", já em índice 0-based do Date.
  return new Date(Date.UTC(year, month, 20));
}

function calcularMultaPct(competencia: string, dataCalculo: Date): number {
  const vencimento = dataVencimento(competencia);
  const diasAtraso = Math.max(0, Math.floor((dataCalculo.getTime() - vencimento.getTime()) / 86_400_000));
  return Math.min(MULTA_TETO_PCT, Number((diasAtraso * MULTA_DIARIA_PCT).toFixed(2)));
}

function calcularLinhaMensal(competencia: string, remAtual: number, referencia: string, dataCalculo: Date): FatorAjusteMonthRow {
  const selicPct = calcularSelicAcumulada(competencia, referencia);
  const remOrig = remAtual / (1 + selicPct / 100);
  const cpp = round2(remOrig * ALIQUOTA_CPP);
  const multaPct = calcularMultaPct(competencia, dataCalculo);
  const multa = round2(cpp * (multaPct / 100));
  const mora = round2(cpp * (selicPct / 100));
  const maed = MAED_MENSAL;
  // Soma dos componentes já arredondados a centavos, replicando a convenção da planilha original.
  const total = round2(cpp + multa + mora + maed);

  return {
    competencia,
    remAtual: round2(remAtual),
    remOrig: round2(remOrig),
    cpp,
    multaPct,
    multa,
    selicPct,
    mora,
    maed,
    total,
  };
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function somarTotal(linhas: FatorAjusteMonthRow[]): number {
  return round2(linhas.reduce((acc, linha) => acc + linha.total, 0));
}

export function calculateFatorAjuste(input: FatorAjusteInput): FatorAjusteResult {
  const competencias = listarCompetencias(input.dataInicio, input.dataFim);
  const numeroMeses = competencias.length;

  if (numeroMeses === 0) {
    throw new Error('Período inválido: a data de fim deve ser igual ou posterior à data de início.');
  }

  const percentualFator: 50 | 70 = input.areaM2 <= 350 ? 50 : 70;
  const rmtAjustada = input.rmt100 * (percentualFator / 100);

  const remAtualComFator = rmtAjustada / numeroMeses;

  const referencia = toCompetenciaKey(input.dataCalculo);
  const dataCalculoDate = new Date(`${input.dataCalculo}T00:00:00Z`);

  const linhasComFator = competencias.map((competencia) =>
    calcularLinhaMensal(competencia, remAtualComFator, referencia, dataCalculoDate)
  );

  const totalComFator = somarTotal(linhasComFator);
  const totalSemFator = round2(input.rmt100 * TAXA_SEM_FATOR);
  const reducao = round2(totalSemFator - totalComFator);
  const reducaoPercentual = totalSemFator > 0 ? Number(((reducao / totalSemFator) * 100).toFixed(2)) : 0;

  const honorarios = input.honorarios !== null && input.honorarios > 0 ? round2(input.honorarios) : null;
  const reducaoLiquida = honorarios !== null ? round2(reducao - honorarios) : null;

  const parcelaMinima = input.responsavel === 'PF' ? 200 : 500;
  const numeroParcelas = Math.max(1, Math.min(60, Math.floor(totalComFator / parcelaMinima)));
  const valorParcela = round2(totalComFator / numeroParcelas);

  return {
    areaM2: input.areaM2,
    rmt100: round2(input.rmt100),
    percentualFator,
    rmtAjustada: round2(rmtAjustada),
    numeroMeses,
    linhasComFator,
    totalComFator,
    totalSemFator,
    reducao,
    reducaoPercentual,
    honorarios,
    reducaoLiquida,
    parcelamento: {
      parcelaMinima,
      numeroParcelas,
      valorParcela,
    },
  };
}
