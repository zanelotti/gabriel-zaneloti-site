export interface ExemploSimulacao {
  id: string;
  perfilObra: string;
  area: string;
  situacao: string;
  reducaoPercentual: number;
}

/**
 * Exemplos ILUSTRATIVOS de simulação — mostram a faixa realista de redução que
 * a metodologia (IN RFB nº 2021/2021) costuma alcançar para diferentes perfis
 * de obra. NÃO são depoimentos nem casos de clientes reais — o disclaimer no
 * componente que os exibe deixa isso explícito. Servem só para dar uma noção
 * concreta de valor antes de o visitante preencher a calculadora.
 */
export const EXEMPLOS_SIMULACAO: ExemploSimulacao[] = [
  {
    id: 'acompanhamento-desde-inicio',
    perfilObra: 'Residencial unifamiliar, com DCTFWeb enviada desde o início da obra',
    area: '320 m²',
    situacao: 'Acompanhamento desde o início',
    reducaoPercentual: 70,
  },
  {
    id: 'multifamiliar',
    perfilObra: 'Condomínio multifamiliar',
    area: '1.500 m²',
    situacao: 'Construída há mais de 5 anos',
    reducaoPercentual: 68,
  },
  {
    id: 'reforma-comercial',
    perfilObra: 'Reforma de salas comerciais',
    area: '900 m²',
    situacao: 'Reforma',
    reducaoPercentual: 65,
  },
  {
    id: 'residencial-unifamiliar',
    perfilObra: 'Residencial unifamiliar, alvenaria',
    area: '380 m²',
    situacao: 'Concluída com Habite-se',
    reducaoPercentual: 62,
  },
  {
    id: 'galpao-industrial',
    perfilObra: 'Galpão industrial, obra nova',
    area: '2.200 m²',
    situacao: 'Em construção',
    reducaoPercentual: 60,
  },
];
