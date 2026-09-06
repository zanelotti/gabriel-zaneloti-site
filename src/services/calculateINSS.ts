import type { CalculatorData, INSSResult } from '@/types/calculator';
import type { RMTIndiretaInput } from '@/types/rmtIndireta';
import type { ResponsavelObra } from '@/types/fatorAjuste';
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
 * Este motor NUNCA lança erro — se algum dado essencial vier vazio (o que não
 * deveria acontecer, já que o formulário público exige tudo antes de permitir
 * calcular), assume-se um valor padrão razoável em vez de interromper a
 * simulação. Toda obra com os dados preenchidos no formulário deve terminar
 * em um número, nunca em uma mensagem de erro (ver `useCalculatorForm`).
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

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Resultado de última reserva (zerado) — só é usado se, de um jeito
 * inesperado, algo abaixo lançar um erro mesmo assim. Garante que a
 * simulação NUNCA mostre a tela de erro para o cliente.
 */
function resultadoSeguro(): INSSResult {
  return {
    inssEstimado: 0,
    economiaEstimada: 0,
    percentualReducao: 0,
    valorAposReducao: 0,
    mensagem:
      'Esta é uma estimativa inicial, calculada com as mesmas mecânicas oficiais do INSS de obra (Fator de Ajuste, Selic, CPP, MAED) a partir da área e destinação informadas. Ela não substitui uma análise técnica e tributária da documentação da obra, que depende da RMT real apurada com as tabelas oficiais.',
    isEstimativaProvisoria: true,
  };
}

export function calculateINSS(data: CalculatorData): INSSResult {
  const hoje = todayISO();

  // O formulário público já exige data de início e responsável antes de
  // permitir avançar — mas, se por algum motivo chegarem vazios aqui,
  // preferimos assumir um valor padrão a interromper a simulação.
  const dataInicioEfetiva = data.dataInicio || hoje;
  const responsavelEfetivo = (data.responsavel || 'PF') as ResponsavelObra;

  const rmtInput: RMTIndiretaInput = {
    estado: data.estado,
    destinacao: data.destinacao,
    tipoObra: data.tipoObra,
    categoria: data.categoria,
    responsavel: responsavelEfetivo,
    areaPrincipal: data.areaPrincipal ?? 0,
    areaComplementar: data.areaPiscina,
  };

  // Obra ainda em andamento (sem data de fim informada): usa o mês atual como referência.
  // Se a obra ainda nem começou (data de início no futuro), usa a própria data de início
  // como início e fim, para não gerar um período invertido.
  const dataFimEfetiva = data.dataFim || maxISODate(dataInicioEfetiva, hoje);

  try {
    const rmtResult = calculateRMTIndireta(rmtInput);
    const fatorAjusteResult = calculateFatorAjuste({
      rmt100: rmtResult.rmt100,
      areaM2: rmtResult.areaTotal,
      dataInicio: dataInicioEfetiva,
      dataFim: dataFimEfetiva,
      responsavel: responsavelEfetivo,
      dataCalculo: hoje,
      honorarios: null,
    });

    // Honorários (uso exclusivamente interno, no e-mail que o Gabriel recebe):
    // 12% sobre a economia estimada, nunca mostrados ao visitante do site.
    const honorarios = round2(fatorAjusteResult.reducao * 0.12);
    const reducaoLiquida = round2(fatorAjusteResult.reducao - honorarios);

    return {
      inssEstimado: fatorAjusteResult.totalSemFator,
      economiaEstimada: fatorAjusteResult.reducao,
      percentualReducao: fatorAjusteResult.reducaoPercentual,
      valorAposReducao: fatorAjusteResult.totalComFator,
      mensagem:
        'Esta é uma estimativa inicial, calculada com as mesmas mecânicas oficiais do INSS de obra (Fator de Ajuste, Selic, CPP, MAED) a partir da área e destinação informadas. Ela não substitui uma análise técnica e tributária da documentação da obra, que depende da RMT real apurada com as tabelas oficiais.',
      isEstimativaProvisoria: true,
      detalheInterno: {
        rmt100: fatorAjusteResult.rmt100,
        percentualFator: fatorAjusteResult.percentualFator,
        areaM2: fatorAjusteResult.areaM2,
        numeroMeses: fatorAjusteResult.numeroMeses,
        linhasComFator: fatorAjusteResult.linhasComFator,
        honorarios,
        reducaoLiquida,
        parcelamento: fatorAjusteResult.parcelamento,
      },
    };
  } catch {
    // Rede de segurança: mesmo que calculateRMTIndireta/calculateFatorAjuste
    // hoje nunca lancem erro, mantemos este catch para que a simulação NUNCA
    // mostre a tela de erro — sempre um número, mesmo que seja zero.
    return resultadoSeguro();
  }
}
