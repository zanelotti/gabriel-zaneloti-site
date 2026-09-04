import type { CalculatorData, INSSResult, Responsavel } from '@/types/calculator';
import type { RMTIndiretaInput } from '@/types/rmtIndireta';
import { calculateRMTIndireta } from './calculateRMTIndireta';
import { calculateFatorAjuste } from './calculateFatorAjuste';

/**
 * ============================================================================
 *  MOTOR DE CÁLCULO DO SIMULADOR PÚBLICO DO SITE
 * ============================================================================
 * Estima o INSS de obra em duas etapas, ambas com base em mecânicas OFICIAIS
 * da IN RFB nº 2021/2021 (não é mais um mock arbitrário):
 *
 *  1. Estima a RMT (100% SERO) a partir da área/destinação/tipo/categoria da
 *     obra e da tabela oficial de VAU por estado — `calculateRMTIndireta()`,
 *     que reproduz a aferição indireta (arts. 15 a 19).
 *  2. Aplica o Fator de Ajuste (50%/70%) e a mecânica mensal de Selic, CPP,
 *     multa, mora e MAED — `calculateFatorAjuste()`, o MESMO motor validado
 *     contra os relatórios reais do Gabriel, usado também na ferramenta
 *     interna (/calculo.html).
 *
 * Por que ainda é uma ESTIMATIVA (`isEstimativaProvisoria: true`), mesmo
 * usando fórmulas reais:
 *  - A RMT real depende de detalhes que o formulário público não pergunta
 *    (mais de uma área/destinação por obra, notas fiscais de pré-moldado,
 *    se a área complementar é coberta ou descoberta — aqui sempre tratada
 *    como descoberta).
 *  - A "data de fim" pode ficar em branco (obra em andamento); nesse caso,
 *    assume-se o mês atual como referência, o que muda o resultado conforme
 *    o dia em que a simulação é refeita.
 *  - O parcelamento mostrado é aproximado (ver `calculateFatorAjuste.ts`).
 *
 * Este motor pode lançar erros (ex: obra com data de início anterior a
 * jan/2021, fora da tabela de Selic mantida no projeto) — quem chama esta
 * função deve tratar isso com try/catch, exibindo uma mensagem amigável em
 * vez de travar a simulação (ver `useCalculatorForm`).
 * ============================================================================
 */

/** Data de hoje, no formato "AAAA-MM-DD", em UTC. */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Maior das duas datas ISO ("AAAA-MM-DD"), como string. */
function maxISODate(a: string, b: string): string {
  return a > b ? a : b;
}

export function calculateINSS(data: CalculatorData): INSSResult {
  if (!data.dataInicio) {
    throw new Error('Informe a data de início da obra.');
  }
  if (!data.destinacao || !data.tipoObra || !data.categoria || !data.estado) {
    throw new Error('Preencha destinação, tipo de obra, categoria e estado da obra.');
  }
  if (!data.responsavel) {
    throw new Error('Selecione o responsável pela obra (Pessoa Física ou Jurídica).');
  }

  const hoje = todayISO();

  const rmtInput: RMTIndiretaInput = {
    estado: data.estado,
    destinacao: data.destinacao,
    tipoObra: data.tipoObra,
    categoria: data.categoria,
    responsavel: data.responsavel,
    areaPrincipal: data.areaPrincipal ?? 0,
    areaComplementar: data.areaPiscina,
  };

  if (rmtInput.areaPrincipal <= 0) {
    throw new Error('Informe a área da construção principal.');
  }

  // Obra ainda em andamento (sem data de fim informada): usa o mês atual como referência.
  // Se a obra ainda nem começou (data de início no futuro), usa a própria data de início
  // como início e fim, para não gerar um período invertido.
  const dataFimEfetiva = data.dataFim || maxISODate(data.dataInicio, hoje);

  let rmtResult;
  let fatorAjusteResult;
  try {
    rmtResult = calculateRMTIndireta(rmtInput);
    fatorAjusteResult = calculateFatorAjuste({
      rmt100: rmtResult.rmt100,
      areaM2: rmtResult.areaTotal,
      dataInicio: data.dataInicio,
      dataFim: dataFimEfetiva,
      responsavel: data.responsavel as Responsavel,
      dataCalculo: hoje,
      honorarios: null,
    });
  } catch {
    // Erros internos (ex: mês fora da tabela de Selic mantida no projeto) não devem
    // vazar detalhes técnicos para quem está preenchendo o formulário público.
    throw new Error(
      'Não conseguimos calcular automaticamente para o período informado (a obra pode estar fora do intervalo de datas que a calculadora cobre hoje).'
    );
  }

  return {
    inssEstimado: fatorAjusteResult.totalSemFator,
    economiaEstimada: fatorAjusteResult.reducao,
    percentualReducao: fatorAjusteResult.reducaoPercentual,
    valorAposReducao: fatorAjusteResult.totalComFator,
    mensagem:
      'Esta é uma estimativa inicial, calculada com as mesmas mecânicas oficiais do INSS de obra (Fator de Ajuste, Selic, CPP, MAED) a partir da área e destinação informadas. Ela não substitui uma análise técnica e tributária da documentação da obra, que depende da RMT real apurada com as tabelas oficiais.',
    isEstimativaProvisoria: true,
  };
}
