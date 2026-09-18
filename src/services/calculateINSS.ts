import type { CalculatorData, INSSResult, RegimeApuracao } from '@/types/calculator';
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
 * eSocial x GFIP (Manual do Sero / IN RFB nº 2.021/2021): o eSocial só se
 * tornou obrigatório para o envio de informações da obra a partir da
 * competência 10/2021 — antes disso, a apuração era feita pelo GFIP.
 *
 * Prática do Gabriel: para obras iniciadas entre 01/2021 e 09/2021, ele
 * desloca o início do CÁLCULO para 10/2021, de forma a poder tramitar tudo
 * já dentro do eSocial (em vez de misturar GFIP + eSocial). Para obras de
 * 2020 para trás, a apuração pelo GFIP é mais complexa (depende de análise
 * caso a caso) e por isso não é exibido cálculo automático ao visitante.
 */
const CORTE_ESOCIAL = '2021-10-01';
const INICIO_JANELA_AJUSTE = '2021-01-01';

/** Determina o regime de apuração a partir da data REAL de início da obra. */
function determinarRegimeApuracao(dataInicio: string): RegimeApuracao {
  if (dataInicio >= CORTE_ESOCIAL) return 'esocial';
  if (dataInicio >= INICIO_JANELA_AJUSTE) return 'esocial_ajustado';
  return 'gfip_anterior_2021';
}

/**
 * Resultado de última reserva (zerado) — só é usado se, de um jeito
 * inesperado, algo abaixo lançar um erro mesmo assim. Garante que a
 * simulação NUNCA mostre a tela de erro para o cliente.
 */
function resultadoSeguro(regimeApuracao: RegimeApuracao): INSSResult {
  return {
    inssEstimado: 0,
    economiaEstimada: 0,
    percentualReducao: 0,
    valorAposReducao: 0,
    mensagem:
      'Esta é uma estimativa inicial, calculada com as mesmas mecânicas oficiais do INSS de obra (Fator de Ajuste, Selic, CPP, MAED) a partir da área e destinação informadas. Ela não substitui uma análise técnica e tributária da documentação da obra, que depende da RMT real apurada com as tabelas oficiais.',
    isEstimativaProvisoria: true,
    regimeApuracao,
  };
}

export function calculateINSS(data: CalculatorData): INSSResult {
  const hoje = todayISO();

  // O formulário público já exige data de início e responsável antes de
  // permitir avançar — mas, se por algum motivo chegarem vazios aqui,
  // preferimos assumir um valor padrão a interromper a simulação.
  const dataInicioEfetiva = data.dataInicio || hoje;
  const responsavelEfetivo = (data.responsavel || 'PF') as ResponsavelObra;
  const regimeApuracao = determinarRegimeApuracao(dataInicioEfetiva);

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

  // Obra iniciada entre 01/2021 e 09/2021 (antes do eSocial ser obrigatório
  // para obras): desloca a competência de início do CÁLCULO para 10/2021,
  // prática do Gabriel para tramitar tudo já pelo eSocial. A data real de
  // início (dataInicioEfetiva) continua sendo usada em todo o resto — resumo,
  // CRM e e-mail — só a competência usada no motor de cálculo é que muda.
  const dataInicioCalculo = regimeApuracao === 'esocial_ajustado' ? CORTE_ESOCIAL : dataInicioEfetiva;
  const dataFimCalculo = maxISODate(dataInicioCalculo, dataFimEfetiva);

  try {
    const rmtResult = calculateRMTIndireta(rmtInput);
    const fatorAjusteResult = calculateFatorAjuste({
      rmt100: rmtResult.rmt100,
      areaM2: rmtResult.areaTotal,
      dataInicio: dataInicioCalculo,
      dataFim: dataFimCalculo,
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
      regimeApuracao,
      detalheInterno: {
        rmt100: fatorAjusteResult.rmt100,
        percentualFator: fatorAjusteResult.percentualFator,
        areaM2: fatorAjusteResult.areaM2,
        numeroMeses: fatorAjusteResult.numeroMeses,
        linhasComFator: fatorAjusteResult.linhasComFator,
        honorarios,
        reducaoLiquida,
        parcelamento: fatorAjusteResult.parcelamento,
        dataInicioAjustada: regimeApuracao === 'esocial_ajustado' ? dataInicioCalculo : undefined,
      },
    };
  } catch {
    // Rede de segurança: mesmo que calculateRMTIndireta/calculateFatorAjuste
    // hoje nunca lancem erro, mantemos este catch para que a simulação NUNCA
    // mostre a tela de erro — sempre um número, mesmo que seja zero.
    return resultadoSeguro(regimeApuracao);
  }
}
