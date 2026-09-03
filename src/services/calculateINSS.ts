import type { CalculatorData, INSSResult } from '@/types/calculator';

/**
 * ============================================================================
 *  MOTOR DE CÁLCULO DO INSS DE OBRA — IMPLEMENTAÇÃO PROVISÓRIA (MOCK)
 * ============================================================================
 *
 * ATENÇÃO: Esta função NÃO implementa a fórmula oficial de cálculo do INSS de
 * obra. É uma estimativa provisória, criada apenas para permitir que a
 * interface, o fluxo de resultado e a integração com WhatsApp funcionem de
 * ponta a ponta antes que a fórmula real seja fornecida.
 *
 * Quando a fórmula definitiva (CUB regional, composição do Fator de Ajuste,
 * alíquotas, regras por tipo/destinação de obra etc.) for definida, troque
 * SOMENTE o corpo desta função — a assinatura (entrada/saída) deve ser
 * mantida para que o restante do site (formulário, resultado, WhatsApp,
 * leads, analytics) continue funcionando sem alterações.
 *
 * NÃO apresentar o valor retornado como cálculo tributário oficial.
 * ============================================================================
 */

/** Valor de referência simplificado por m² (mock), usado apenas para simular uma base de cálculo. */
const VALOR_BASE_POR_M2 = 1900;

/** Alíquota simplificada de INSS de obra utilizada apenas na simulação provisória. */
const ALIQUOTA_INSS_MOCK = 0.2;

const FATOR_TIPO_OBRA: Record<string, number> = {
  alvenaria: 1,
  madeira: 0.75,
  mista: 0.9,
};

const FATOR_DESTINACAO: Record<string, number> = {
  residencial_unifamiliar: 1,
  multifamiliar: 1.05,
  comercial_salas_lojas: 1.1,
  galpao_industrial: 0.95,
  conjunto_habitacional: 1.05,
  edificio_garagem: 0.9,
};

const FATOR_SITUACAO_REDUCAO: Record<string, number> = {
  concluida_com_habite_se: 0.35,
  concluida_sem_habite_se: 0.28,
  em_construcao: 0.32,
  iniciar_em_breve: 0.4,
  construida_ha_mais_de_5_anos: 0.22,
};

function clampPercentual(valor: number): number {
  return Math.min(70, Math.max(10, valor));
}

export function calculateINSS(data: CalculatorData): INSSResult {
  const areaPrincipal = data.areaPrincipal ?? 0;
  const areaPiscina = data.areaPiscina ?? 0;

  const fatorTipo = FATOR_TIPO_OBRA[data.tipoObra] ?? 1;
  const fatorDestinacao = FATOR_DESTINACAO[data.destinacao] ?? 1;

  // Base simulada: área principal com peso do tipo/destinação da obra + piscina com peso reduzido.
  const areaEquivalente = areaPrincipal * fatorTipo * fatorDestinacao + areaPiscina * 0.4;

  const valorObraEstimado = areaEquivalente * VALOR_BASE_POR_M2;
  const inssEstimado = Math.max(0, valorObraEstimado * ALIQUOTA_INSS_MOCK);

  const percentualBase = (FATOR_SITUACAO_REDUCAO[data.situacao] ?? 0.3) * 100;
  const percentualReducao = clampPercentual(percentualBase);

  const economiaEstimada = inssEstimado * (percentualReducao / 100);
  const valorAposReducao = Math.max(0, inssEstimado - economiaEstimada);

  return {
    inssEstimado: Number(inssEstimado.toFixed(2)),
    economiaEstimada: Number(economiaEstimada.toFixed(2)),
    percentualReducao: Number(percentualReducao.toFixed(1)),
    valorAposReducao: Number(valorAposReducao.toFixed(2)),
    mensagem:
      'Esta é uma estimativa inicial e provisória, calculada por um motor mock. Ela não substitui uma análise técnica e tributária da documentação da obra.',
    isEstimativaProvisoria: true,
  };
}
