export interface ServiceItem {
  id: string;
  titulo: string;
  descricao: string;
  icone: 'reducao' | 'regularizacao' | 'cno' | 'sero' | 'darf' | 'cnd' | 'planejamento';
}

/**
 * Serviços oferecidos por Gabriel Zaneloti.
 * Conteúdo baseado nas informações reais divulgadas em gabrielzaneloti.com.br —
 * nenhum serviço, certificação ou resultado foi inventado.
 */
export const SERVICES: ServiceItem[] = [
  {
    id: 'reducao-inss',
    titulo: 'Redução de INSS de Obras',
    descricao:
      'Análise das possibilidades legais de redução do valor devido, com aplicação do Fator de Ajuste sobre o INSS da sua obra.',
    icone: 'reducao',
  },
  {
    id: 'regularizacao-obras',
    titulo: 'Regularização de Obras',
    descricao: 'Acompanhamento completo do processo de regularização da sua construção junto aos órgãos competentes.',
    icone: 'regularizacao',
  },
  {
    id: 'cno',
    titulo: 'CNO',
    descricao: 'Cadastro e manutenção do Cadastro Nacional de Obras, garantindo conformidade total da sua obra.',
    icone: 'cno',
  },
  {
    id: 'sero',
    titulo: 'SERO',
    descricao:
      'Gestão completa do Serviço Eletrônico de Regularização de Obras, acompanhando todo o processo de aferição.',
    icone: 'sero',
  },
  {
    id: 'darf',
    titulo: 'DARF',
    descricao: 'Apuração e emissão mensal do DARF, com os valores corretos após a aplicação das reduções fiscais.',
    icone: 'darf',
  },
  {
    id: 'cnd',
    titulo: 'CND',
    descricao: 'Auxílio na regularização necessária para a obtenção da Certidão Negativa de Débitos da sua obra.',
    icone: 'cnd',
  },
  {
    id: 'planejamento-tributario',
    titulo: 'Planejamento Tributário',
    descricao: 'Planejamento adequado para reduzir custos dentro das possibilidades legais previstas em lei.',
    icone: 'planejamento',
  },
];
