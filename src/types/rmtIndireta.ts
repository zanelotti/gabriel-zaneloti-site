import type { CategoriaObra, Destinacao, Responsavel, TipoObra } from './calculator';

export interface RMTIndiretaInput {
  estado: string;
  destinacao: Destinacao;
  tipoObra: TipoObra;
  categoria: CategoriaObra;
  responsavel: Responsavel;
  /** Área da construção principal, em m². */
  areaPrincipal: number;
  /**
   * Área complementar opcional (ex: piscina), em m². Tratada como área
   * complementar DESCOBERTA (redutor de 75%) — simplificação assumida pela
   * calculadora pública, que não distingue coberta/descoberta.
   */
  areaComplementar: number | null;
}

export interface RMTIndiretaResult {
  rmt100: number;
  /** Área total (principal + complementar), usada como referência de porte da obra. */
  areaTotal: number;
  detalhes: {
    vauPorM2: number;
    percentualEquivalencia: number;
    areaTotalParaCalculoPrincipal: number;
    custoObraPrincipal: number;
    areaTotalParaCalculoComplementar: number;
    custoObraComplementar: number;
    percentualMaoDeObra: number;
    percentualCategoria: number;
    percentualDestinacao: number;
    percentualFatorSocial: number;
  };
}
