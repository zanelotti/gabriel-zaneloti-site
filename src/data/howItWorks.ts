export interface HowItWorksStep {
  numero: string;
  titulo: string;
  descricao: string;
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    numero: '01',
    titulo: 'Faça sua simulação',
    descricao: 'Informe os dados básicos da sua obra em 3 etapas rápidas. Um analista entra em contato pelo WhatsApp para conversar com você.',
  },
  {
    numero: '02',
    titulo: 'Analisamos sua situação',
    descricao: 'As características e a documentação da obra são avaliadas com atenção aos detalhes.',
  },
  {
    numero: '03',
    titulo: 'Identificamos as possibilidades',
    descricao: 'Verificamos as estratégias e possibilidades de redução aplicáveis ao seu caso.',
  },
  {
    numero: '04',
    titulo: 'Regularizamos sua obra',
    descricao: 'Acompanhamento de todo o processo necessário para a regularização da sua construção.',
  },
];
