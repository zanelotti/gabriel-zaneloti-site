import type { Destinacao, TipoObra } from '@/types/calculator';
import type { RMTIndiretaInput, RMTIndiretaResult } from '@/types/rmtIndireta';
import { VAU_ESTADUAL } from '@/data/vauEstadual';

/**
 * ============================================================================
 *  APURAÇÃO DA RMT POR AFERIÇÃO INDIRETA (IN RFB nº 2021/2021, arts. 15 a 19)
 * ============================================================================
 * Reproduz a mecânica oficial usada pelo Sero para estimar a Remuneração da
 * Mão de Obra Total (RMT) de uma obra predial a partir da área do projeto,
 * usada pelo simulador PÚBLICO do site (que não tem como coletar a RMT real
 * do usuário — só ele, com o CUB/VAU e as tabelas oficiais, apura isso).
 *
 * Cadeia de cálculo (uma vez para a área principal, outra para a área
 * complementar informada, e soma-se o resultado):
 *
 *   1. Área total para cálculo = área × percentual de equivalência
 *      (áreas principais) OU área × redutor de área complementar
 *      (áreas complementares — 50% coberta / 25% descoberta)              — art. 17
 *   2. Custo da obra por destinação = área total para cálculo × VAU        — art. 18
 *   3. RMT (da área) = custo × % mão de obra (por tipo de obra)
 *                            × % categoria (obra nova/reforma/demolição)
 *                            × % destinação (edifício de garagens = 80%)
 *                            × Fator Social (só Pessoa Física, por faixa
 *                              de área total)                              — art. 19
 *
 * Todos os percentuais fixos abaixo foram conferidos contra os exemplos
 * numéricos do próprio Manual do Sero (cap. III) e batem exatamente.
 *
 * SIMPLIFICAÇÕES assumidas nesta calculadora pública (documentadas para quem
 * for dar manutenção):
 *  - Só existe UMA área principal e UMA área complementar (ex: piscina) por
 *    simulação — a Sero de verdade aceita várias áreas de destinações
 *    diferentes por obra, o que não faz sentido pedir em um formulário de
 *    lead curto.
 *  - A área complementar informada é sempre tratada como DESCOBERTA (redutor
 *    de 75%) — normalmente é uma piscina, o caso mais comum.
 *  - Não há redução por Nota Fiscal de pré-moldado/pré-fabricado (a obra
 *    pública não pergunta isso).
 *  - "Casa popular" não é uma destinação separada aqui — obras desse porte
 *    caem em "Conjunto habitacional" (mesma faixa de percentuais).
 * ============================================================================
 */

const DESTINACAO_PARA_VAU: Record<Exclude<Destinacao, ''>, keyof (typeof VAU_ESTADUAL)[string]> = {
  residencial_unifamiliar: 'residencialUnifamiliar',
  multifamiliar: 'residencialMultifamiliar',
  comercial_salas_lojas: 'comercialSalasLojas',
  galpao_industrial: 'galpaoIndustrial',
  conjunto_habitacional: 'conjuntoHabitacionalPopular',
  edificio_garagem: 'edificioGaragens',
};

/** Art. 17.1 — Percentual de Equivalência, por destinação e faixa de área principal. */
function percentualEquivalencia(destinacao: Destinacao, areaPrincipal: number): number {
  switch (destinacao) {
    case 'residencial_unifamiliar':
      return areaPrincipal <= 1000 ? 0.89 : 0.85;
    case 'multifamiliar':
      return areaPrincipal <= 1000 ? 0.9 : 0.86;
    case 'comercial_salas_lojas':
      return areaPrincipal <= 3000 ? 0.86 : 0.83;
    case 'edificio_garagem':
      return areaPrincipal <= 3000 ? 0.86 : 0.83;
    case 'galpao_industrial':
      return 0.95;
    case 'conjunto_habitacional':
      return 0.98;
    default:
      return 0.9;
  }
}

/** Art. 17.2 — Redutor de área complementar (assumida sempre descoberta nesta calculadora). */
const REDUTOR_AREA_COMPLEMENTAR_DESCOBERTA = 0.25;

/** Art. 19.1 — Percentual de Mão de Obra sobre o Custo da Obra, por tipo de obra e grupo de destinação. */
function percentualMaoDeObra(tipoObra: TipoObra, destinacao: Destinacao): number {
  const grupoCasaPopular = destinacao === 'conjunto_habitacional';

  if (grupoCasaPopular) {
    if (tipoObra === 'alvenaria') return 0.12;
    return 0.07; // madeira ou mista
  }

  if (tipoObra === 'alvenaria') return 0.2;
  return 0.15; // madeira ou mista
}

/** Art. 19.2 — Percentual de Cálculo por Categoria de obra. */
function percentualCategoria(categoria: RMTIndiretaInput['categoria']): number {
  switch (categoria) {
    case 'reforma':
      return 0.35;
    case 'demolicao':
      return 0.1;
    case 'obra_nova':
    case 'acrescimo':
    default:
      return 1;
  }
}

/** Art. 19.3 — Percentual de Cálculo por Destinação (só Edifício de Garagens tem redução). */
function percentualDestinacao(destinacao: Destinacao): number {
  return destinacao === 'edificio_garagem' ? 0.8 : 1;
}

/** Art. 19.4 — Fator Social (só Pessoa Física), por faixa de área total da categoria. */
function percentualFatorSocial(areaTotal: number): number {
  if (areaTotal <= 100) return 0.2;
  if (areaTotal <= 200) return 0.4;
  if (areaTotal <= 300) return 0.55;
  if (areaTotal <= 400) return 0.7;
  return 0.9;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

/**
 * Média nacional do VAU por destinação — usada apenas como aproximação de
 * reserva para um estado que por algum motivo não esteja cadastrado em
 * VAU_ESTADUAL (hoje as 27 UFs estão cobertas). O formulário público já exige
 * a escolha de um estado válido antes de chegar aqui, então este caminho é só
 * uma proteção extra para a simulação nunca falhar em vez de gerar um número.
 */
function vauMedioNacional(destinacaoVau: keyof (typeof VAU_ESTADUAL)[string]): number {
  const valores = Object.values(VAU_ESTADUAL).map((tabela) => tabela[destinacaoVau]);
  return valores.reduce((soma, valor) => soma + valor, 0) / valores.length;
}

export function calculateRMTIndireta(input: RMTIndiretaInput): RMTIndiretaResult {
  const { estado, destinacao, tipoObra, categoria, responsavel } = input;

  // O formulário público já exige destinação, tipo de obra e categoria antes
  // de permitir avançar — mas, se por algum motivo chegarem vazios aqui,
  // preferimos assumir os valores mais comuns a falhar a simulação.
  const destinacaoEfetiva = destinacao || 'residencial_unifamiliar';
  const tipoObraEfetivo = tipoObra || 'alvenaria';
  const categoriaEfetiva = categoria || 'obra_nova';

  const vauEstado = VAU_ESTADUAL[estado];
  const destinacaoVau = DESTINACAO_PARA_VAU[destinacaoEfetiva];
  const vauPorM2 = vauEstado ? vauEstado[destinacaoVau] : vauMedioNacional(destinacaoVau);

  const areaPrincipal = Math.max(0, input.areaPrincipal);
  const areaComplementar = Math.max(0, input.areaComplementar ?? 0);
  const areaTotal = areaPrincipal + areaComplementar;

  const equivalencia = percentualEquivalencia(destinacaoEfetiva, areaPrincipal);
  const areaTotalParaCalculoPrincipal = areaPrincipal * equivalencia;
  const custoObraPrincipal = areaTotalParaCalculoPrincipal * vauPorM2;

  const areaTotalParaCalculoComplementar = areaComplementar * REDUTOR_AREA_COMPLEMENTAR_DESCOBERTA;
  const custoObraComplementar = areaTotalParaCalculoComplementar * vauPorM2;

  const maoDeObra = percentualMaoDeObra(tipoObraEfetivo, destinacaoEfetiva);
  const catPct = percentualCategoria(categoriaEfetiva);
  const destPct = percentualDestinacao(destinacaoEfetiva);
  const fatorSocial = responsavel === 'PF' ? percentualFatorSocial(areaTotal) : 1;

  const multiplicador = maoDeObra * catPct * destPct * fatorSocial;

  const rmtPrincipal = custoObraPrincipal * multiplicador;
  const rmtComplementar = custoObraComplementar * multiplicador;

  return {
    rmt100: round2(rmtPrincipal + rmtComplementar),
    areaTotal,
    detalhes: {
      vauPorM2,
      percentualEquivalencia: equivalencia,
      areaTotalParaCalculoPrincipal: round2(areaTotalParaCalculoPrincipal),
      custoObraPrincipal: round2(custoObraPrincipal),
      areaTotalParaCalculoComplementar: round2(areaTotalParaCalculoComplementar),
      custoObraComplementar: round2(custoObraComplementar),
      percentualMaoDeObra: maoDeObra,
      percentualCategoria: catPct,
      percentualDestinacao: destPct,
      percentualFatorSocial: fatorSocial,
    },
  };
}
