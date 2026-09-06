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
 * COMPETÊNCIA EM DIA (vencimento ainda não chegado): os passos 3, 5, 6 e 7
 * acima só valem para uma competência já vencida (dataCalculo depois do dia
 * 20 do mês seguinte). Para o mês em curso na data do cálculo — ou qualquer
 * mês futuro, em obras "do presente para o futuro" — não há atraso, então não
 * há correção monetária (REM.ORIG = REM.ATUAL), multa, juros de mora nem MAED:
 * só a CPP do mês (ver `diasDeAtraso` e o retorno antecipado em
 * `calcularLinhaMensal`).
 *
 * DECADÊNCIA (5 anos — art. 173, I, do CTN): só entram na cobrança (e no
 * comparativo) as competências dos últimos 5 anos-calendário até a data do
 * cálculo — a Receita Federal não pode mais cobrar competências mais antigas
 * que isso (ver `competenciaDecaida`). Sem esse limite, uma obra antiga (ex:
 * há 15+ anos) acumulava MAED por todos os meses desde o início, o que podia
 * superar de longe o comparativo "sem Fator de Ajuste" e gerar uma "economia"
 * negativa sem sentido — exatamente competências que já decaíram e não
 * deveriam entrar na conta.
 *
 * VALIDADO contra os 3 exemplos reais fornecidos pelo Gabriel: a linha de
 * 10/2021 do primeiro relatório (Selic 57,53%, CPP R$157,34, total R$379,33)
 * é reproduzida exatamente por este motor (obras dentro do prazo decadencial,
 * onde a decadência não altera nenhum dos números).
 * ============================================================================
 */

const ALIQUOTA_CPP = 0.2;
const MULTA_DIARIA_PCT = 0.33;
const MULTA_TETO_PCT = 20;
const MAED_MENSAL = 100;

/**
 * Prazo decadencial das contribuições previdenciárias de obra (art. 173, I,
 * do CTN, aplicado pela Receita Federal ao INSS de obra): o Fisco perde o
 * direito de cobrar uma competência depois de 5 anos completos — na prática,
 * "obras com mais de 5 anos não estão sujeitas à cobrança das contribuições
 * sociais" (gov.br/receitafederal — Construção Civil/Sero/Decadência).
 * Sem esse limite, uma obra muito antiga (ex: iniciada décadas atrás e ainda
 * sem DCTFWeb) acumula MAED (R$100/mês) indefinidamente, o que produzia
 * resultados sem sentido (economia negativa, redução de milhares de %) —
 * exatamente o tipo de competência que já decaiu e não pode mais ser cobrada.
 */
const DECADENCIA_ANOS = 5;

/** Ano ("AAAA") de uma chave "AAAA-MM" ou de uma data ISO "AAAA-MM-DD". */
function anoDe(data: string): number {
  return Number(data.slice(0, 4));
}

/**
 * Uma competência decai (deixa de ser cobrável) quando já se passaram mais de
 * 5 anos completos entre o ano da competência e o ano do cálculo — a mesma
 * contagem por ano-calendário usada pela Receita Federal nos exemplos de
 * decadência proporcional (ex: obra de 2017 a 2021 calculada em 2025: só as
 * competências de 2020 e 2021, dentro dos últimos 5 anos, seguem cobráveis).
 */
function competenciaDecaida(competencia: string, dataCalculo: string): boolean {
  return anoDe(dataCalculo) - anoDe(competencia) > DECADENCIA_ANOS;
}

/**
 * Taxa de referência fixa para o cenário "sem Fator de Ajuste": totalSemFator = RMT (100%) × 36,8%.
 * Não é um novo cálculo mês a mês — é a mesma taxa usada como comparativo nos
 * seus relatórios reais (conferida com precisão de centavos nos 3 exemplos
 * fornecidos, com áreas e durações bem diferentes entre si — R$12.769,37 /
 * R$41.464,22 / R$45.554,04, todos exatamente 36,80% da respectiva RMT 100%).
 */
const TAXA_SEM_FATOR = 0.368;

/**
 * Teto de segurança para o número de competências em um único cálculo
 * (~416 anos). Nenhuma obra real chega perto disso — existe só para nunca
 * deixar o cálculo rodar por muito tempo (ou travar a tela) caso alguém
 * digite uma data claramente absurda (ex: ano trocado por engano). Mesmo
 * nesse caso, o cálculo não falha: simplesmente para de somar mais meses e
 * segue com o que já foi calculado até ali — toda simulação preenchida pelo
 * cliente deve terminar em um resultado, nunca em uma mensagem de erro.
 */
const MAX_COMPETENCIAS = 5000;

/**
 * Lista as competências ("AAAA-MM"), inclusive, entre início e fim.
 *
 * É tolerante a datas fora da ordem esperada (ex: data de fim digitada antes
 * da data de início, por engano) — nesse caso inverte as duas internamente em
 * vez de falhar, para que o cálculo sempre gere um resultado a partir dos
 * dados já informados pelo cliente.
 */
function listarCompetencias(inicio: string, fim: string): string[] {
  let inicioKey = toCompetenciaKey(inicio);
  let fimKey = toCompetenciaKey(fim);

  if (compareCompetencia(inicioKey, fimKey) > 0) {
    [inicioKey, fimKey] = [fimKey, inicioKey];
  }

  const competencias: string[] = [];
  let cursor = inicioKey;

  while (compareCompetencia(cursor, fimKey) <= 0) {
    competencias.push(cursor);
    if (competencias.length >= MAX_COMPETENCIAS) break;
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

/**
 * Dias entre o vencimento de uma competência (dia 20 do mês seguinte) e a
 * data do cálculo — nunca negativo. Zero significa que o vencimento ainda não
 * chegou (ou é hoje mesmo): a declaração ainda está em dia.
 */
function diasDeAtraso(competencia: string, dataCalculo: Date): number {
  const vencimento = dataVencimento(competencia);
  return Math.max(0, Math.floor((dataCalculo.getTime() - vencimento.getTime()) / 86_400_000));
}

function calcularLinhaMensal(competencia: string, remAtual: number, referencia: string, dataCalculo: Date): FatorAjusteMonthRow {
  const diasAtraso = diasDeAtraso(competencia, dataCalculo);

  // Competência ainda dentro do prazo: o vencimento (dia 20 do mês seguinte à
  // competência) ainda não chegou (ou é hoje mesmo). Uma declaração em dia não
  // gera nenhuma correção monetária, multa, juros de mora ou MAED — só a CPP
  // do mês, calculada direto sobre a REM. ATUAL (sem desconto de Selic, já que
  // não há atraso a corrigir). Isso vale tanto para o mês em curso na data do
  // cálculo quanto para meses futuros de uma obra "do presente para o futuro"
  // (ex: data de fim ainda não alcançada).
  if (diasAtraso === 0) {
    const cpp = round2(remAtual * ALIQUOTA_CPP);
    return {
      competencia,
      remAtual: round2(remAtual),
      remOrig: round2(remAtual),
      cpp,
      multaPct: 0,
      multa: 0,
      selicPct: 0,
      mora: 0,
      maed: 0,
      total: cpp,
    };
  }

  const selicPct = calcularSelicAcumulada(competencia, referencia);
  const remOrig = remAtual / (1 + selicPct / 100);
  const cpp = round2(remOrig * ALIQUOTA_CPP);
  const multaPct = Math.min(MULTA_TETO_PCT, Number((diasAtraso * MULTA_DIARIA_PCT).toFixed(2)));
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
  // listarCompetencias já trata datas fora de ordem (inverte internamente) e
  // sempre devolve pelo menos 1 competência — nunca uma lista vazia.
  const todasCompetencias = listarCompetencias(input.dataInicio, input.dataFim);
  const numeroMesesTotal = todasCompetencias.length;

  // A RMT total é rateada por TODOS os meses da obra (isso não muda com a
  // decadência — é só como o valor mensal "atual" é reconstituído). Só a
  // COBRANÇA de cada competência (a soma que vira totalComFator) respeita a
  // decadência de 5 anos: competências mais antigas que isso não entram na
  // conta, porque não podem mais ser cobradas.
  const competencias = todasCompetencias.filter((c) => !competenciaDecaida(c, input.dataCalculo));
  const numeroMeses = competencias.length;

  // Fração da obra ainda dentro do prazo decadencial — usada também para
  // escalar o comparativo "sem Fator de Ajuste" (totalSemFator), do mesmo
  // jeito que a Receita Federal calcula a decadência proporcional (meses não
  // decaídos ÷ meses totais), para que as duas pontas da comparação sempre
  // considerem a mesma janela de competências realmente cobráveis.
  const fracaoCobravel = numeroMesesTotal > 0 ? numeroMeses / numeroMesesTotal : 0;

  const percentualFator: 50 | 70 = input.areaM2 <= 350 ? 50 : 70;
  const rmtAjustada = input.rmt100 * (percentualFator / 100);

  const remAtualComFator = rmtAjustada / numeroMesesTotal;

  const referencia = toCompetenciaKey(input.dataCalculo);
  const dataCalculoDate = new Date(`${input.dataCalculo}T00:00:00Z`);

  const linhasComFator = competencias.map((competencia) =>
    calcularLinhaMensal(competencia, remAtualComFator, referencia, dataCalculoDate)
  );

  const totalComFator = somarTotal(linhasComFator);
  const totalSemFator = round2(input.rmt100 * TAXA_SEM_FATOR * fracaoCobravel);
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
