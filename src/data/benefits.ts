export interface BenefitItem {
  id: string;
  titulo: string;
  descricao: string;
}

export const BENEFITS: BenefitItem[] = [
  {
    id: 'economia',
    titulo: 'Economia',
    descricao: 'Identificação das possibilidades legais de redução, com economia de até 70% no valor do imposto.',
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    descricao: 'Acompanhamento especializado, com certificação de que a obra segue os padrões exigidos.',
  },
  {
    id: 'regularizacao',
    titulo: 'Regularização',
    descricao: 'Regularização da obra junto ao CNO e ao SERO, evitando multas e entraves futuros.',
  },
  {
    id: 'documentacao',
    titulo: 'Documentação',
    descricao: 'Organização e acompanhamento dos documentos necessários para obter certidões e alvarás.',
  },
  {
    id: 'tranquilidade',
    titulo: 'Tranquilidade',
    descricao: 'Redução dos riscos relacionados à regularização, com processos conduzidos por um especialista.',
  },
  {
    id: 'planejamento',
    titulo: 'Planejamento',
    descricao: 'Análise antecipada da obra para identificar oportunidades e evitar surpresas tributárias.',
  },
];
