export interface FAQItem {
  pergunta: string;
  resposta: string;
}

/**
 * Perguntas frequentes baseadas no conteúdo real de gabrielzaneloti.com.br.
 * Nenhuma afirmação jurídica/tributária foi criada sem fundamento no material de origem.
 */
export const FAQ_ITEMS: FAQItem[] = [
  {
    pergunta: 'O que é o INSS de Obras?',
    resposta:
      'É a contribuição previdenciária devida em obras de construção civil com mão de obra contratada. O valor é apurado com base nas características da construção e recolhido junto à Receita Federal.',
  },
  {
    pergunta: 'Como funciona a regularização da minha obra?',
    resposta:
      'A regularização passa pelo cadastro da obra no CNO (Cadastro Nacional de Obras) e pela aferição pelo SERO (Serviço Eletrônico para Aferição de Obras), etapas necessárias para apurar corretamente o INSS devido.',
  },
  {
    pergunta: 'O que é o CNO?',
    resposta:
      'O CNO (Cadastro Nacional de Obras) é o cadastro que identifica a obra perante a Receita Federal. É a partir dele que a situação da construção é acompanhada e regularizada.',
  },
  {
    pergunta: 'O que é o SERO?',
    resposta:
      'O SERO (Serviço Eletrônico para Aferição de Obras) é o processo pelo qual a Receita Federal afere o valor do INSS devido sobre a obra, com base na documentação e nas características informadas.',
  },
  {
    pergunta: 'O que é o Fator de Ajuste?',
    resposta:
      'É uma metodologia, prevista na Instrução Normativa RFB nº 2021/2021, que permite ajustar os valores tributários reportados em um projeto de construção, podendo reduzir legalmente o INSS apurado sobre a obra.',
  },
  {
    pergunta: 'Como funciona a redução do INSS de obra?',
    resposta:
      'A partir da análise das características e da documentação da sua obra, avaliamos a aplicação do Fator de Ajuste e de outras possibilidades legais previstas na legislação para reduzir o valor do INSS devido.',
  },
  {
    pergunta: 'Minha obra precisa ser regularizada?',
    resposta:
      'Todos os tipos de construção — residencial, comercial ou industrial — precisam ser regularizados. A ausência de regularização pode gerar multas, dificultar financiamentos e impedir a venda do imóvel.',
  },
  {
    pergunta: 'O que é a CND de obra?',
    resposta:
      'É a Certidão Negativa de Débitos relativa à obra, que atesta a inexistência de débitos previdenciários vinculados à construção. Costuma ser exigida em processos de venda, financiamento e regularização documental do imóvel.',
  },
  {
    pergunta: 'Quais as consequências de não regularizar a obra junto ao SERO?',
    resposta:
      'A obra pode ficar sujeita a multas, dificuldades para obter financiamento, complicações na venda do imóvel e impedimentos legais até que a situação seja regularizada.',
  },
  {
    pergunta: 'Atendem obras em outros estados, fora do Rio de Janeiro?',
    resposta: 'Sim. O atendimento é feito para obras em qualquer lugar do Brasil, de forma remota.',
  },
  {
    pergunta: 'Posso aplicar a redução sozinho?',
    resposta:
      'É altamente recomendável buscar o apoio de um profissional especializado, já que a análise envolve documentação técnica e a legislação aplicável ao Fator de Ajuste.',
  },
  {
    pergunta: 'Quanto posso economizar no INSS da minha obra?',
    resposta:
      'A economia varia conforme as características, a documentação e a situação de cada obra, podendo chegar a até 70% do valor do imposto. A simulação é o primeiro passo para ter uma estimativa inicial.',
  },
];
