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

/**
 * Mensagens de boas-vindas (1 a 3 mensagens curtas). Nunca citam valores, honorário nem prometem resultado.
 * @param {{origem: string, nome?: string, assistente?: string}} p
 */
export function montarBoasVindas({ origem, nome = '', assistente = 'Lia' }) {
  const oi = nome ? `Oi, ${nome}, tudo bem?` : 'Oi, tudo bem?';
  const apresentacao = `${oi} Aqui é ${assistente}, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra.`;
  const pergunta = 'Para eu te orientar bem: a obra já foi concluída ou ainda está em andamento?';

  switch (origem) {
    case 'dores':
      return [
        `${apresentacao} Vi que você se identificou com alguma das situações do nosso site.`,
        `Qual delas é a mais parecida com a sua?\n${DORES_LISTA.map((d, i) => `${i + 1}) ${d}`).join('\n')}\nPode responder só com o número.`,
      ];
    case 'tranquilidade':
      return [
        `${apresentacao} Deixar a obra em dia, sem dor de cabeça com a Receita, é exatamente o que o Gabriel faz.`,
        'Você precisa da certidão da obra para vender, financiar ou averbar o imóvel, ou quer só deixar tudo em dia?',
      ];
    case 'beneficios':
      return [
        `${apresentacao} O Gabriel cuida de todo o processo para reduzir o INSS que a Receita cobraria da obra, do começo ao fim.`,
        pergunta,
      ];
    case 'final':
      return [
        `${apresentacao} Que bom que você quer começar. A análise inicial é gratuita e sem compromisso.`,
        pergunta,
      ];
    case 'ebook':
    case 'ebook_baixou':
      return [
        `${apresentacao} Vi que você baixou o e-book "Como reduzir o INSS da sua obra". Espero que ajude!`,
        'Para ver se a sua obra tem redução, preciso entender o caso: ela já foi concluída ou ainda está em andamento?',
      ];
    case 'topo':
    case 'flutuante':
    case 'rodape':
    default:
      return [
        `${apresentacao} Que bom ter você por aqui. O Gabriel cuida de todo o processo para reduzir o INSS que a Receita cobraria da obra.`,
        pergunta,
      ];
  }
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
    dores: 'Ela clicou na seção das situações comuns e recebeu uma lista numerada de 5 situações: 1) recebeu o valor do INSS da obra e não sabe se está certo; 2) precisa vender, financiar ou averbar e falta a certidão; 3) obra antiga e dúvida se ainda cobram; 4) tem notas e comprovantes de mão de obra e não sabe se valem como desconto; 5) falta tempo para lidar sozinha com a Receita. Se ela responder só com um número (ou com a situação), siga por esse caminho; se escolher outra coisa, entenda e adapte.',
    tranquilidade: 'Ela clicou na seção "sua obra em dia, sem dor de cabeça com a Receita" e já recebeu a pergunta se precisa da certidão para vender, financiar ou averbar, ou se quer só deixar tudo em dia. Se for venda, financiamento ou averbação, a urgência é a certidão (CND); se for só deixar em dia, mostre a tranquilidade de ter a obra regular.',
    beneficios: 'Ela clicou no botão da seção de benefícios: quer entender como funciona. Explique o essencial em doses e descubra o caso dela.',
    final: 'Ela clicou no botão do final da página: já decidiu chamar. Seja direta, mostre que a análise inicial é gratuita e descubra o caso para levá-la ao próximo passo.',
    ebook: 'Ela baixou o e-book "Como reduzir o INSS da sua obra" e, depois, tocou no botão de WhatsApp. Já leu ou está lendo o material, então vá direto ao caso dela.',
    ebook_baixou: 'Ela baixou o e-book "Como reduzir o INSS da sua obra", mas ainda não escreveu para o Gabriel; o bot falou primeiro. Seja leve, sem pressionar: o interesse dela é entender como reduzir. Se ela não responder, o acompanhamento automático cuida do resto.',
    topo: 'Ela clicou no botão de WhatsApp do topo do site: tem interesse em reduzir o INSS da obra, sem mais detalhes.',
    flutuante: 'Ela clicou no botão flutuante de WhatsApp: provavelmente tem uma dúvida pontual. Responda a dúvida primeiro e depois entenda o caso.',
    rodape: 'Ela usou o link de WhatsApp do rodapé do site: provavelmente tem uma dúvida pontual. Responda a dúvida primeiro e depois entenda o caso.',
    site: 'Ela veio de um botão de WhatsApp do site, sem mais detalhes.',
  };
  return `\n\nROTEIRO DESTE LEAD (CONTATO PELO WHATSAPP, SEM SIMULAÇÃO): ${porOrigem[origem] || porOrigem.site}
A pessoa AINDA NÃO preencheu a simulação do site: você NÃO tem números, tipo de obra, área nem datas. Por isso:
- Descubra o caso com no máximo 3 perguntas de diagnóstico, UMA por mensagem, curtas e objetivas, na ordem que fizer sentido: (a) a obra é em nome de pessoa física ou de empresa; (b) está concluída ou em andamento e quando terminou (ou termina); (c) em que estado fica e o tamanho aproximado. Não repita pergunta que a mensagem de boas-vindas ou ela mesma já respondeu.
- Passe valor em doses, um benefício por mensagem, ligado ao que ela contar (com base no CONHECIMENTO). Nunca despeje tudo de uma vez.
- NUNCA cite valores de INSS, de economia ou "quanto ela vai pagar": você não tem esses números. Se ela perguntar quanto vai pagar de INSS, diga que depende da obra e que o jeito mais rápido de ter uma estimativa é a simulação do site${link}, ou a análise gratuita do Gabriel.
- Depois do diagnóstico, leve a pessoa a UM próximo passo: a simulação no site (rápida, mostra que a obra tem como reduzir) ou, em caso complexo (obra antiga, empresa, muitos documentos, pressa por certidão), a consultoria gratuita com o Gabriel. Quando ela fizer a simulação, os dados chegam a você automaticamente.
- Honorário só se ela perguntar, ou no final da conversa: pessoa física = 12% sobre a economia comprovada na análise, com valor mínimo de R$ 800; empresa = R$ 1.000 mais 12% sobre a economia conseguida. Forma de pagamento conforme o CONHECIMENTO. Nunca ofereça desconto.
- Se ela disser que quer contratar, envie a mensagem dos dados do contrato (lista de pessoa física ou de empresa, conforme o caso dela).
- Se for pessoa física, a frente de mão de obra é o trabalhador autônomo com INSS recolhido ligado ao CNO (inclusive retroativo); nunca fale em funcionário registrado/CLT para pessoa física. Para empresa vale o que está no CONHECIMENTO.`;
}
