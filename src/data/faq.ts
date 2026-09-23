export interface FAQItem {
  pergunta: string;
  resposta: string;
}

/**
 * Perguntas frequentes. As primeiras priorizam objeções comuns de quem está
 * decidindo se fecha ou não (pagamento, garantia, prazo, abrangência); as
 * seguintes são educativas sobre o processo, baseadas no conteúdo real de
 * gabrielzaneloti.com.br. Nenhuma afirmação foi criada sem fundamento no
 * material de origem.
 */
export const FAQ_ITEMS: FAQItem[] = [
  {
    pergunta: 'Preciso pagar algo adiantado para começar?',
    resposta:
      'Não. O diagnóstico inicial é 100% gratuito e sem compromisso. Se você decidir seguir com a regularização, o honorário é uma porcentagem sobre a economia comprovada na sua obra — e, nos casos em que não há redução a aplicar, um valor mínimo, calculado conforme a complexidade do processo.',
  },
  {
    pergunta: 'E se a análise não encontrar nenhuma redução possível?',
    resposta:
      'O diagnóstico inicial continua sem custo algum. Se, mesmo sem redução identificada, você decidir seguir com a regularização da obra, o honorário nesse caso passa a ser um valor mínimo definido pela complexidade e pelas especificidades do processo — não uma porcentagem sobre economia, já que não haveria economia a considerar.',
  },
  {
    pergunta: 'Quanto tempo demora o processo?',
    resposta:
      'O prazo varia conforme a complexidade da obra, a documentação disponível e os trâmites junto à Receita Federal. Depois da análise inicial da sua obra, você recebe uma estimativa de prazo específica para o seu caso.',
  },
  {
    pergunta: 'Atendem qualquer tipo de obra — residencial, comercial ou industrial?',
    resposta:
      'Sim. Atendo obras residenciais, comerciais e industriais, de pessoa física e jurídica, de qualquer estado do Brasil, de forma remota.',
  },
  {
    pergunta: 'Eu preciso fazer alguma parte do processo sozinho?',
    resposta:
      'Cuido de todo o levantamento técnico e do trâmite junto à Receita Federal. Da sua parte, só preciso da documentação da obra (datas, área, notas fiscais e comprovantes de mão de obra, quando existirem) para iniciar a análise.',
  },
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
    pergunta: 'Como funciona a redução do INSS de obra?',
    resposta:
      'A partir da análise das características e da documentação da sua obra, avaliamos a aplicação do Fator de Ajuste (para pessoa física) e de outras possibilidades previstas na Instrução Normativa RFB nº 2021/2021 para reduzir o valor do INSS devido.',
  },
  {
    pergunta: 'Minha obra precisa ser regularizada mesmo se eu não for vender ou financiar?',
    resposta:
      'Sim. Todos os tipos de construção precisam ser regularizados perante a Receita Federal. A ausência de regularização pode gerar multas e juros que crescem mês a mês, além de dificultar financiamentos e a venda do imóvel no futuro.',
  },
  {
    pergunta: 'O que é a CND de obra?',
    resposta:
      'É a Certidão Negativa de Débitos relativa à obra, que atesta a inexistência de débitos previdenciários vinculados à construção (ou, quando há parcelamento em dia, a CPEND). Costuma ser exigida em processos de venda, financiamento e regularização documental do imóvel, e não tem prazo de validade.',
  },
  {
    pergunta: 'Posso aplicar a redução sozinho?',
    resposta:
      'É altamente recomendável buscar o apoio de um profissional especializado, já que a análise envolve documentação técnica e as regras aplicáveis ao Fator de Ajuste e às demais possibilidades de redução.',
  },
  {
    pergunta: 'Quanto posso economizar no INSS da minha obra?',
    resposta:
      'A economia varia conforme as características, a documentação e a situação de cada obra, podendo chegar a até 70% do valor do imposto — o percentual mais alto costuma acontecer quando há acompanhamento contínuo (DCTFWeb) desde o início da obra. A simulação gratuita é o primeiro passo para ter uma estimativa inicial do seu caso.',
  },
];
