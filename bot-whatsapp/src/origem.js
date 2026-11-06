/**
 * Contatos que NÃO vieram da calculadora: quem clica num botão de WhatsApp do site e manda a mensagem pronta,
 * e quem baixa o e-book (tabela `guia_leads`).
 *
 * Como o bot reconhece cada situação:
 *  - Cada botão do site abre o WhatsApp com uma mensagem pronta que parece escrita pela própria pessoa ("Olá, Gabriel! Vim pelo
 *    seu site e ..."), sem nenhum código. A frase é diferente em cada botão e é por ela que o bot descobre de qual veio e conduz
 *    a conversa de acordo (ver FRASES_ORIGEM).
 *  - Quem baixa o e-book vira um "lead" no CRM com id `ebook-<n>` (e quem manda mensagem pelo botão vira `wa-<origem>-<sufixo>`).
 *    A origem fica gravada no próprio id, então NÃO precisa mexer na estrutura do banco de dados.
 *
 * As mensagens de boas-vindas são prontas (sem inteligência artificial): saem na hora, sem números e sem honorário,
 * e terminam com UMA pergunta objetiva.
 */

/** Códigos aceitos (o mesmo conjunto usado em src/services/whatsappOrigens.ts, no site). */
export const ORIGENS = ['topo', 'beneficios', 'dores', 'tranquilidade', 'final', 'flutuante', 'rodape', 'ebook', 'ebook_baixou', 'site'];

const ROTULO = {
  topo: 'botão de WhatsApp do topo do site',
  beneficios: 'botão de WhatsApp da seção de benefícios',
  dores: 'botão da seção "Você se identifica com alguma dessas situações?"',
  tranquilidade: 'botão da seção "Sua obra em dia, sem dor de cabeça com a Receita"',
  final: 'botão de WhatsApp do final da página',
  flutuante: 'botão flutuante de WhatsApp do site',
  rodape: 'link de WhatsApp do rodapé do site',
  ebook: 'botão de WhatsApp que aparece depois de baixar o e-book "Como reduzir o INSS da sua obra"',
  ebook_baixou: 'download do e-book "Como reduzir o INSS da sua obra" (ela deixou nome, e-mail e WhatsApp; ainda não escreveu para o Gabriel)',
  site: 'mensagem pronta do site',
};

export const rotuloDaOrigem = (origem) => ROTULO[origem] || ROTULO.site;

/**
 * Frase de cada botão do site, depois de "Olá, Gabriel! Vim pelo seu site e ...". A mensagem pronta parece escrita pela própria
 * pessoa (sem código nenhum): o bot reconhece o botão por esta frase, que é diferente em cada um.
 * IMPORTANTE: precisam ser idênticas às de src/services/whatsapp.ts, no site (FRASE_ORIGEM).
 */
export const FRASES_ORIGEM = {
  topo: 'quero saber como reduzir o INSS da minha obra',
  beneficios: 'quero entender como funciona a regularização do INSS da minha obra',
  dores: 'me identifiquei com uma das situações e quero falar sobre a minha obra',
  tranquilidade: 'quero deixar a minha obra em dia, sem dor de cabeça com a Receita',
  final: 'quero começar a análise gratuita da minha obra',
  flutuante: 'tenho uma dúvida sobre o INSS da minha obra',
  rodape: 'quero falar com você sobre o INSS da minha obra',
};

/** Minúsculas, sem acento, sem pontuação nas pontas e com espaços simples: deixa a comparação tolerante a pequenas diferenças. */
const normalizar = (t) =>
  String(t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * A mensagem veio de um botão do site?
 * @returns {{origem: string, textoLimpo: string, soModelo: boolean, nome: string|null} | null}
 */
export function detectarOrigemSite(texto) {
  const textoLimpo = String(texto ?? '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const n = normalizar(textoLimpo);
  const comeca = /^ola,? gabriel!? /.test(n);

  let origem = null;
  let soModelo = false;
  let nome = null;

  if (comeca && /baixei o e-?book/.test(n)) {
    origem = 'ebook';
    soModelo = /^ola,? gabriel! baixei o e-?book "[^"\n]+" e gostaria de saber se a minha obra tem reducao\.( meu nome e [^.\n]+\.)?$/.test(n);
    nome = /meu nome é ([^.\n]{2,60})\./i.exec(textoLimpo)?.[1]?.trim() || null;
  } else if (comeca && n.includes('vim pelo seu site')) {
    origem = 'site';
    for (const [cod, frase] of Object.entries(FRASES_ORIGEM)) {
      if (n.includes(normalizar(frase))) {
        origem = cod;
        // "Só o modelo": a frase pronta exatamente como veio, sem nada acrescentado. Se a pessoa escreveu algo a mais, o assistente responde ao que ela disse.
        soModelo = n.replace(/[.!\s]+$/, '') === normalizar(`Olá, Gabriel! Vim pelo seu site e ${frase}`);
        break;
      }
    }
  }
  if (!origem) return null;
  return { origem, textoLimpo, soModelo, nome };
}

/** Id do lead criado para um contato de origem externa (a origem fica dentro do id). */
export function novoIdLeadExterno(origem) {
  const sufixo = Math.random().toString(36).slice(2, 8);
  return `wa-${origem}-${Date.now().toString(36)}${sufixo}`;
}

export const idLeadEbook = (guiaId) => `ebook-${guiaId}`;

export function ehLeadExterno(lead) {
  return /^(wa-[a-z_]+-|ebook-)/.test(String(lead?.id ?? ''));
}

/**
 * Contato externo que AINDA não passou os dados da obra (sem simulação). Depois que o assistente registra os dados
 * (calcular_simulacao grava o tipo, o estado, a área etc. no card), ele passa a ser tratado como um lead normal, com números.
 */
export const semSimulacao = (lead) => ehLeadExterno(lead) && !lead?.responsavel;

/** Descobre a origem a partir do id do lead. Leads da calculadora devolvem null. */
export function origemDoLead(lead) {
  const id = String(lead?.id ?? '');
  if (id.startsWith('ebook-')) return 'ebook_baixou';
  const m = /^wa-([a-z_]+)-/.exec(id);
  if (m) return ORIGENS.includes(m[1]) ? m[1] : 'site';
  return null;
}

const DORES_LISTA = [
  'Recebi o valor do INSS da obra e não sei se está certo',
  'Preciso vender, financiar ou averbar o imóvel e falta a certidão',
  'Minha obra é antiga e não sei se ainda dá para cobrar',
  'Tenho notas e comprovantes da mão de obra e não sei se valem como desconto',
  'Falta tempo para lidar sozinho com a Receita',
];

/** Explicação curta do Fator de Ajuste (só o que está no CONHECIMENTO do Gabriel; sem prometer resultado). */
export const TEXTO_FATOR_AJUSTE =
  'Funciona assim: a Receita presume um valor de mão de obra para a obra. Pelo Fator de Ajuste, se a mão de obra declarada durante a obra chegar a 50% desse valor (70% em obra acima de 350 m²), o débito presumido pode ser zerado, e você paga só o INSS dessa mão de obra, que costuma ser bem menor. Na obra de pessoa física, isso é feito com o INSS dos trabalhadores autônomos ligados ao CNO, que pode ser recolhido até de forma retroativa, mesmo com a obra pronta. O saldo ainda pode ser parcelado em até 60 vezes.';

/** Pedido de dados da obra (uma lista só, para a pessoa responder tudo de uma vez). */
export const PEDIDO_DADOS_OBRA = [
  'Para fazer a sua simulação agora, me manda estas informações da obra (pode ser tudo de uma vez):',
  '1) Obra em nome de pessoa física ou de empresa',
  '2) Estado (UF) onde fica a obra',
  '3) Tipo da obra: alvenaria, madeira ou mista',
  '4) Uso: casa, prédio de apartamentos, comercial (salas e lojas), galpão, conjunto habitacional ou edifício-garagem',
  '5) Se é obra nova, acréscimo, reforma ou demolição',
  '6) Área construída em m² (e a da piscina ou de área externa, se tiver)',
  '7) Mês e ano de início da obra e de término (ou "em andamento")',
].join('\n');

/**
 * Mensagens de boas-vindas (2 ou 3 mensagens curtas). Nunca citam valores, honorário nem prometem resultado.
 * Quem chega pelo botão do site recebe sempre o mesmo caminho direto, sem enrolar: quem é a pessoa, como funciona o Fator de Ajuste
 * e o pedido das informações da obra (com elas o bot faz a simulação ali mesmo, na conversa).
 * @param {{origem: string, nome?: string, assistente?: string, nomeConfirmado?: boolean}} p `nomeConfirmado`: a própria pessoa disse o nome (ex.: no e-book)
 */
export function montarBoasVindas({ origem, nome = '', assistente = 'Lia', nomeConfirmado = false }) {
  if (origem === 'ebook_baixou') {
    const oi = nome ? `Oi, ${nome}, tudo bem?` : 'Oi, tudo bem?';
    return [
      `${oi} Aqui é ${assistente}, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra. Vi que você baixou o e-book "Como reduzir o INSS da sua obra". Espero que ajude!`,
      'Para ver se a sua obra tem redução, preciso entender o caso: ela já foi concluída ou ainda está em andamento?',
    ];
  }
  const apresentacao = `Aqui é ${assistente}, assistente do Gabriel Zaneloti, especialista em redução de INSS de obra. Vou te mostrar uma estimativa de quanto a sua obra pode reduzir.`;
  const primeira = nomeConfirmado && nome ? `Oi, ${nome}! ${apresentacao}` : `Oi! ${apresentacao} Com quem eu falo?`;
  return [primeira, TEXTO_FATOR_AJUSTE, PEDIDO_DADOS_OBRA];
}

/**
 * Abertura enviada a quem baixou o e-book e ainda não escreveu (o bot fala primeiro, como nos leads da calculadora).
 * Termina com UMA pergunta objetiva. Sem números, sem honorário.
 */
export function montarAberturaEbook({ nome = '', assistente = 'Lia' }) {
  const [a, b] = montarBoasVindas({ origem: 'ebook_baixou', nome, assistente });
  return { variante: 'E-book baixado', texto: `${a}\n\n${b}` };
}

/**
 * Trecho do prompt que explica de onde a pessoa veio e como conduzir. Vale para leads sem simulação (externos).
 */
export function roteiroDaOrigem(origem, { siteUrl = '' } = {}) {
  const link = siteUrl ? ` (${siteUrl}/#calculadora)` : '';
  const porOrigem = {
    dores: 'Ela clicou no botão da seção das situações comuns ("Você se identifica com alguma dessas situações?"): tem uma dor com a obra. Acolha em uma frase e siga para os dados.',
    tranquilidade: 'Ela clicou no botão da seção "sua obra em dia, sem dor de cabeça com a Receita": quer a obra regular. Se ela contar que precisa da certidão para vender, financiar ou averbar, a urgência é a certidão (CND).',
    beneficios: 'Ela clicou no botão da seção de benefícios: quer entender como funciona.',
    final: 'Ela clicou no botão do final da página: já decidiu chamar. Seja direta, a análise inicial é gratuita.',
    ebook: 'Ela baixou o e-book "Como reduzir o INSS da sua obra" e, depois, tocou no botão de WhatsApp. Vá direto ao caso dela.',
    ebook_baixou: 'Ela baixou o e-book "Como reduzir o INSS da sua obra", mas ainda não escreveu para o Gabriel; o bot falou primeiro. Seja leve, sem pressionar: o interesse dela é entender como reduzir. Se ela não responder, o acompanhamento automático cuida do resto.',
    topo: 'Ela clicou no botão de WhatsApp do topo do site: tem interesse em reduzir o INSS da obra.',
    flutuante: 'Ela clicou no botão flutuante de WhatsApp: pode ter uma dúvida pontual. Responda a dúvida primeiro, em uma ou duas frases, e volte aos dados da simulação.',
    rodape: 'Ela usou o link de WhatsApp do rodapé do site: pode ter uma dúvida pontual. Responda a dúvida primeiro, em uma ou duas frases, e volte aos dados da simulação.',
    site: 'Ela veio de um botão de WhatsApp do site, sem mais detalhes.',
  };
  const chegouPeloBotao = origem !== 'ebook_baixou';
  const abertura = chegouPeloBotao
    ? 'A mensagem de boas-vindas JÁ foi enviada por você: perguntou quem é a pessoa, explicou o Fator de Ajuste e pediu as informações da obra (pessoa física ou empresa; estado; tipo; uso; categoria; áreas; datas de início e término). Não repita nada disso.'
    : 'Ela ainda não respondeu à sua abertura. Quando responder, conduza para a simulação da obra.';
  return `\n\nROTEIRO DESTE LEAD (CONTATO PELO WHATSAPP, AINDA SEM SIMULAÇÃO): ${porOrigem[origem] || porOrigem.site}
${abertura}
SEU OBJETIVO AGORA: FAZER A SIMULAÇÃO da obra aqui na conversa, rápido e sem enrolar. A pessoa AINDA NÃO tem números: quem os calcula é a ferramenta calcular_simulacao, que ENVIA a simulação para ela na conversa e por e-mail para o Gabriel. Por isso:
- Se ela ainda não disse como prefere ser chamada, use registrar_nome quando disser (ela já foi perguntada).
- Leia tudo o que ela escreveu e peça, em UMA mensagem curta (pode ser uma lista curta), SÓ o que ainda falta. Esta é a exceção à regra de uma pergunta por mensagem. Nunca repita o que ela já informou; se falta só um item, pergunte só ele. Se ela responder só parte, peça o resto sem enrolar.
- Interprete com bom senso e não pergunte o que dá para deduzir: "casa" = residencial unifamiliar; "prédio de apartamentos" = multifamiliar; "loja" ou "sala comercial" = comercial; "construção do zero" = obra nova; "ampliação" = acréscimo; mês e ano bastam para as datas (use o dia 01); obra em andamento = sem data de término; se ela não falou de piscina ou área externa, considere sem. Estado vale a sigla (UF).
- Quando tiver pessoa física ou empresa, estado, tipo da obra, uso, categoria, área principal e data de início, use calcular_simulacao (com a área complementar e a data de término só se ela informou). Se faltar algo, a ferramenta devolve o que falta.
- Depois de calcular_simulacao com ok e enviada, escreva UMA mensagem curta, SEM valores em reais (a simulação já está acima na conversa): diga que é uma estimativa inicial que o Gabriel confirma com os documentos e faça UMA pergunta para avançar (por exemplo, se durante a obra houve pedreiro, pintor, eletricista ou outro prestador autônomo). Não repita nem comente os números.
- Se for EMPRESA: o Fator de Ajuste não se aplica e não existe simulação com valores. Use calcular_simulacao só com responsavel PJ (e o que ela já informou) para registrar no cadastro, explique em 2 frases as frentes que valem para empresa (CONHECIMENTO, "formas de reduzir") e faça UMA pergunta de diagnóstico.
- Se ela perguntar quanto vai pagar ou quanto economiza antes de passar os dados: diga que é exatamente isso que a simulação mostra e peça o que falta. Não invente valores: você não tem números.
- Se for dúvida sobre o jeito que o serviço funciona, responda curto (CONHECIMENTO) e volte ao pedido dos dados.
- Se a obra começou antes de 2021, a simulação mostra só o INSS estimado (a redução depende de análise do período e dos documentos): diga isso com naturalidade e leve ao Gabriel.
- Honorário só se ela perguntar o custo: pessoa física = 12% sobre a economia comprovada na análise, com valor mínimo de R$ 800; empresa = R$ 1.000 mais 12% sobre a economia conseguida. Forma de pagamento conforme o CONHECIMENTO. Nunca ofereça desconto.
- Se ela disser que quer contratar, envie a mensagem dos dados do contrato (lista de pessoa física ou de empresa, conforme o caso dela).
- Se for pessoa física, a frente de mão de obra é o trabalhador autônomo com INSS recolhido ligado ao CNO (inclusive retroativo); nunca fale em funcionário registrado/CLT para pessoa física. Para empresa vale o que está no CONHECIMENTO.
- Se ela preferir fazer a simulação sozinha, o simulador do site faz o mesmo${link}.`;
}

/**
 * Para quem já recebeu a simulação do bot (contato externo com dados registrados): o que fazer em seguida.
 */
export const ROTEIRO_POS_SIMULACAO =
  'ORIGEM: esta pessoa chegou pelo WhatsApp do site (não pela calculadora) e a SIMULAÇÃO JÁ FOI ENVIADA a ela nesta conversa (os números estão nos DADOS e a mensagem está no histórico). Não reenvie o texto dos números por iniciativa própria; se ela perguntar, repita os valores EXATOS dos DADOS, sempre como estimativa. Se ela corrigir algum dado da obra (área, datas, estado, tipo), use calcular_simulacao de novo com TODOS os dados já corrigidos: a nova simulação é enviada sozinha.';

