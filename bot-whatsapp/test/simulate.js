/**
 * Testes com tudo simulado (nenhuma chamada real a WhatsApp, Supabase, Claude ou site).
 * Rode com: npm test
 */
import assert from 'node:assert/strict';
import { criarBot } from '../src/bot.js';
import { criarCerebro, montarHistorico } from '../src/brain.js';
import { dividirMensagens, extrairValoresReais, pediuParar, validarSaida } from '../src/guards.js';
import { montarAbertura } from '../src/opening.js';
import { montarSistema } from '../src/prompt.js';
import { carregarConhecimento } from '../src/conhecimento.js';
import { criarSite } from '../src/site.js';
import { normalizarTelefoneBR } from '../src/util.js';

let passou = 0;
const teste = async (nome, fn) => {
  try {
    await fn();
    passou += 1;
    console.log(`  ok  ${nome}`);
  } catch (e) {
    console.error(`  FALHOU  ${nome}\n${e.stack}`);
    process.exitCode = 1;
  }
};

const silencioso = { info() {}, warn() {}, error() {} };
const config = {
  tetoMensagens24h: 100,
  aberturaMinMs: 0,
  aberturaMaxMs: 0,
  debounceMs: 60000,
  maxIdadeLeadHoras: 48,
  economiaMinParaReuniao: 5000,
  listaTeste: [],
  assistenteNome: 'Lia',
};

// --------------------------------------------------------------------------- simulações
function lead(extra = {}) {
  return {
    id: `lead-${Math.random().toString(16).slice(2, 8)}`,
    nome: 'maria da SILVA',
    whatsapp: '(11) 91234-5678',
    responsavel: 'PF',
    area_principal: 180,
    data_inicio: '2023-03-01',
    inss_estimado: 80000,
    economia_estimada: 42000,
    percentual_reducao: 52,
    valor_apos_reducao: 38000,
    status: 'novo',
    notas: null,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

function criarStoreMemoria() {
  const leads = new Map();
  const conversas = [];
  const mensagens = [];
  let seq = 0;
  return {
    leads,
    conversas,
    mensagens,
    async inicioDoBot() {
      return new Date(Date.now() - 60000).toISOString();
    },
    async leadsNovos() {
      return [...leads.values()].filter((l) => l.status === 'novo');
    },
    async leadPorId(id) {
      return leads.get(id) || null;
    },
    async conversaPorLead(id) {
      return conversas.find((c) => c.lead_id === id) || null;
    },
    async criarConversa(c) {
      if (conversas.some((x) => x.lead_id === c.lead_id)) return null;
      const row = { id: `c${++seq}`, estado: 'ativa', observacao: null, ...c };
      conversas.push(row);
      return row;
    },
    async conversaPorTelefone(t) {
      return conversas.find((c) => c.telefone === t) || null;
    },
    async conversaPorId(id) {
      return conversas.find((c) => c.id === id) || null;
    },
    async setEstado(id, estado, obs) {
      const c = conversas.find((x) => x.id === id);
      c.estado = estado;
      if (obs !== undefined) c.observacao = obs;
    },
    async addMensagem(m) {
      mensagens.push({ ...m, criado_em: new Date().toISOString() });
    },
    async historico(id) {
      return mensagens.filter((m) => m.conversa_id === id);
    },
    async contarMensagensBot() {
      return mensagens.filter((m) => m.direcao === 'bot').length;
    },
    async atualizarLead(id, { status, nota }) {
      const l = leads.get(id);
      if (!l || l.status === 'fechado') return;
      if (status) l.status = status;
      if (nota) l.notas = `${l.notas ? `${l.notas}\n` : ''}${nota}`;
    },
  };
}

function criarWaFalso() {
  const enviados = [];
  return {
    enviados,
    conectado: () => true,
    async resolverJid(t) {
      return t.endsWith('0000') ? null : `${t}@s.whatsapp.net`;
    },
    async enviarTexto(jid, texto) {
      enviados.push({ jid, texto });
      return `id${enviados.length}`;
    },
  };
}

/** Cliente "Anthropic" falso: roteiro é uma lista de respostas (cada uma com blocos de conteúdo). */
function clienteFalso(roteiro) {
  const chamadas = [];
  return {
    chamadas,
    messages: {
      async create(params) {
        chamadas.push(JSON.parse(JSON.stringify(params)));
        const proxima = roteiro.shift();
        if (!proxima) throw new Error('roteiro do teste acabou');
        return { content: proxima };
      },
    },
  };
}

const texto = (t) => [{ type: 'text', text: t }];
const uso = (name, input, id = `tu_${name}`) => ({ type: 'tool_use', id, name, input });

function montar({ roteiro = [], siteFalso, parado = () => false, cfg = {} } = {}) {
  const store = criarStoreMemoria();
  const wa = criarWaFalso();
  const avisos = [];
  const notificar = {
    async avisar(a) {
      avisos.push(a);
    },
    async enviar(assunto) {
      avisos.push({ tipo: assunto });
    },
  };
  const client = clienteFalso(roteiro);
  const cfgFinal = { ...config, ...cfg };
  const cerebro = criarCerebro({ modelo: 'teste', config: cfgFinal, client, conhecimento: carregarConhecimento() });
  const site =
    siteFalso ||
    criarSite({
      siteUrl: 'https://exemplo.test',
      fetchImpl: async () => ({ ok: true, json: async () => ({ dias: [] }) }),
    });
  const bot = criarBot({ store, wa, cerebro, site, notificar, config: cfgFinal, log: silencioso, dormirFn: async () => {}, parado });
  return { store, wa, avisos, client, bot };
}

async function abrir(ctx, l) {
  ctx.store.leads.set(l.id, l);
  await ctx.bot.processarNovosLeads();
  return ctx.store.conversas.find((c) => c.lead_id === l.id);
}

const telefoneDe = (c) => c.telefone;

// --------------------------------------------------------------------------- testes
console.log('\nGuardas e mensagens');

await teste('telefone brasileiro é normalizado', () => {
  assert.equal(normalizarTelefoneBR('(11) 91234-5678'), '5511912345678');
  assert.equal(normalizarTelefoneBR('+55 11 91234-5678'), '5511912345678');
  assert.equal(normalizarTelefoneBR('123'), null);
});

await teste('pedidos de parada são detectados (e conversa normal não)', () => {
  for (const t of ['pare', 'PARAR!', 'não quero mais receber mensagens', 'Não me mande mais', 'me tire da lista', 'pare de me enviar mensagem']) {
    assert.equal(pediuParar(t), true, t);
  }
  for (const t of ['quanto custa?', 'não sei ainda', 'pode parar na minha obra amanhã', 'sim, pode explicar']) {
    assert.equal(pediuParar(t), false, t);
  }
});

await teste('validarSaida bloqueia palavras e promessas proibidas', () => {
  const l = lead();
  for (const t of [
    'Você só paga se economizar',
    'É risco zero para você',
    'Isso é totalmente legal',
    'Fale com um advogado',
    'Sua pessoa jurídica pode reduzir',
    'O mínimo que cobro é alto',
    'O honorário é 15% da economia',
    'Eu garanto que você economiza',
    'Você economiza R$ 9.999',
  ]) {
    assert.equal(validarSaida(t, l).ok, false, t);
  }
  assert.equal(validarSaida('O honorário é de 12% sobre a economia que a gente conseguir comprovar.', l).ok, true);
  assert.equal(validarSaida('A estimativa do site foi de R$ 42.000 de economia.', l).ok, true);
  assert.equal(validarSaida('A estimativa ficou em torno de R$ 42.000,00.', l).ok, true);
});

await teste('PJ nunca pode citar valor de economia', () => {
  const pj = lead({ responsavel: 'PJ' });
  assert.equal(validarSaida('Dá para economizar R$ 42.000', pj).ok, false);
  assert.equal(validarSaida('Para empresa o caminho é outro.', pj).ok, true);
});

await teste('extrairValoresReais entende formatos brasileiros', () => {
  assert.deepEqual(extrairValoresReais('R$ 2.386 e R$ 1.234,56 e R$80'), [2386, 1234.56, 80]);
});

await teste('dividirMensagens limita a 3 partes', () => {
  assert.equal(dividirMensagens('a\n\nb\n\nc\n\nd\n\ne').length, 3);
  assert.equal(dividirMensagens('uma só').length, 1);
});

await teste('todas as variantes de abertura passam nas travas e se apresentam como assistente', () => {
  const casos = [
    lead(),
    lead({ economia_estimada: 12000, percentual_reducao: 20 }),
    lead({ economia_estimada: 2386, percentual_reducao: 10 }),
    lead({ responsavel: 'PJ' }),
    lead({ data_inicio: '2018-02-01' }),
    lead({ inss_estimado: null, economia_estimada: null }),
    lead({ nome: '', area_principal: null, economia_estimada: null }),
  ];
  const variantes = new Set();
  for (const l of casos) {
    const a = montarAbertura(l);
    variantes.add(a.variante);
    assert.match(a.texto, /Aqui é Lia, assistente do Gabriel Zaneloti/);
    assert.doesNotMatch(a.texto, /virtual/i);
    assert.equal(validarSaida(a.texto, l).ok, true, `${a.variante}: ${validarSaida(a.texto, l).motivo}`);
    assert.doesNotMatch(a.texto, /12%|honor[aá]rio/i, 'abertura não fala de honorário');
  }
  assert.equal(variantes.size, 7);
});

await teste('prompt contém dados do lead, regras e política de reunião', () => {
  const grande = montarSistema(lead(), config);
  assert.match(grande, /12%/);
  assert.match(grande, /R\$\s?42\.000/);
  assert.match(grande, /pode oferecer a consultoria/);
  const pequena = montarSistema(lead({ economia_estimada: 2386 }), config);
  assert.match(pequena, /NÃO ofereça reunião/);
  const pj = montarSistema(lead({ responsavel: 'PJ' }), config);
  assert.match(pj, /NÃO cite nenhum valor de economia/);
});

await teste('histórico alterna user/assistant e começa com user', () => {
  const h = montarHistorico([
    { direcao: 'bot', texto: 'abertura' },
    { direcao: 'lead', texto: 'oi' },
    { direcao: 'lead', texto: 'quanto custa?' },
    { direcao: 'humano', texto: 'oi, é o Gabriel' },
    { direcao: 'lead', texto: 'ok' },
  ]);
  assert.equal(h[0].role, 'user');
  for (let i = 1; i < h.length; i++) assert.notEqual(h[i].role, h[i - 1].role);
  assert.equal(h[h.length - 1].role, 'user');
  assert.match(h[2].content, /oi\n\nquanto custa/);
});

console.log('\nFluxo do bot');

await teste('lead novo recebe a abertura uma única vez e vai para "contatado"', async () => {
  const ctx = montar();
  const l = lead();
  const c = await abrir(ctx, l);
  assert.equal(ctx.wa.enviados.length, 1);
  assert.match(ctx.wa.enviados[0].texto, /Aqui é Lia, assistente do Gabriel/);
  assert.equal(c.estado, 'ativa');
  assert.equal(ctx.store.leads.get(l.id).status, 'contatado');
  // Reinício do bot / nova varredura: não duplica
  ctx.store.leads.get(l.id).status = 'novo';
  await ctx.bot.processarNovosLeads();
  assert.equal(ctx.wa.enviados.length, 1);
});

await teste('número sem WhatsApp: não envia, registra e avisa o Gabriel', async () => {
  const ctx = montar();
  const l = lead({ whatsapp: '(11) 90000-0000' });
  // telefone termina em 0000 → o WA falso responde que não existe
  const c = await abrir(ctx, l);
  assert.equal(ctx.wa.enviados.length, 0);
  assert.equal(c.estado, 'encerrada');
  assert.equal(ctx.avisos.length, 1);
});

await teste('telefone inválido: não envia e avisa', async () => {
  const ctx = montar();
  const c = await abrir(ctx, lead({ whatsapp: '123' }));
  assert.equal(ctx.wa.enviados.length, 0);
  assert.equal(c.estado, 'encerrada');
  assert.equal(ctx.avisos.length, 1);
});

await teste('lead antigo (mais de 48h) não é abordado', async () => {
  const ctx = montar();
  const c = await abrir(ctx, lead({ created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString() }));
  assert.equal(c, undefined);
  assert.equal(ctx.wa.enviados.length, 0);
});

await teste('lista de teste: só fala com números da lista', async () => {
  const ctx = montar({ cfg: { listaTeste: ['11999990000'] } });
  const c = await abrir(ctx, lead());
  assert.equal(c, undefined);
  assert.equal(ctx.wa.enviados.length, 0);
});

await teste('bot parado (kill switch): não envia nada', async () => {
  const ctx = montar({ parado: () => true });
  await abrir(ctx, lead());
  assert.equal(ctx.wa.enviados.length, 0);
});

await teste('teto de mensagens em 24h trava os envios e avisa', async () => {
  const ctx = montar({ cfg: { tetoMensagens24h: 0 } });
  await abrir(ctx, lead());
  assert.equal(ctx.wa.enviados.length, 0);
  assert.equal(ctx.avisos.length, 1);
});

await teste('lead pergunta o custo: assistente responde (12% sobre economia comprovada)', async () => {
  const ctx = montar({
    roteiro: [texto('É um percentual sobre a economia que a gente conseguir comprovar, calculado depois da análise do seu caso. O percentual é de 12%.\n\nO que pesa mais para você nessa decisão?')],
  });
  const l = lead();
  const c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'Qual é o custo pra conseguir essa economia?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.wa.enviados.length, 3); // abertura + 2 mensagens
  assert.match(ctx.wa.enviados[1].texto, /12%/);
  assert.equal(ctx.avisos.length, 0, 'não manda e-mail só porque o lead respondeu');
  // O modelo recebeu o histórico e as ferramentas
  const chamada = ctx.client.chamadas[0];
  assert.ok(chamada.tools.length === 5);
  assert.equal(chamada.messages[chamada.messages.length - 1].role, 'user');
});

await teste('resposta com "só paga se economizar" é bloqueada e reescrita', async () => {
  const ctx = montar({
    roteiro: [texto('Você só paga se economizar, sem risco!'), texto('O honorário é calculado sobre a economia comprovada. O que você precisa ver para decidir?')],
  });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'como funciona a cobrança?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  const ultimo = ctx.wa.enviados[ctx.wa.enviados.length - 1].texto;
  assert.doesNotMatch(ultimo, /só paga|risco/i);
  assert.equal(ctx.client.chamadas.length, 2);
  assert.match(JSON.stringify(ctx.client.chamadas[1].messages), /AVISO INTERNO/);
});

await teste('3 respostas bloqueadas seguidas: passa para o Gabriel em vez de arriscar', async () => {
  const ruim = texto('Você economiza R$ 9.999 garantido');
  const ctx = montar({ roteiro: [ruim, ruim, ruim] });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'quanto eu economizo?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.store.conversas[0].estado, 'humano');
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /Gabriel continuar/);
  assert.ok(ctx.avisos.find((a) => a.tipo === 'Passou para você'));
});

await teste('agendamento: ver_horarios → agendar_consultoria → confirmação', async () => {
  const chamadasSite = [];
  const site = criarSite({
    siteUrl: 'https://exemplo.test',
    fetchImpl: async (url, opts) => {
      chamadasSite.push({ url, opts });
      if (url.endsWith('/api/agenda-horarios')) {
        return {
          ok: true,
          json: async () => ({
            duracaoMinutos: 30,
            dias: [{ data: '2026-10-24', horarios: [{ inicio: '2026-10-24T12:00:00.000Z' }, { inicio: '2026-10-24T15:00:00.000Z' }, { inicio: '2026-10-24T19:00:00.000Z' }] }],
          }),
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  const ctx = montar({
    siteFalso: site,
    roteiro: [
      [uso('ver_horarios', {})],
      texto('Tenho sábado às 09h, às 12h ou às 16h. Qual fica melhor para você?'),
    ],
  });
  const l = lead();
  const c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'pode ser, quero marcar' });
  await ctx.bot.responder(c.id);

  // Lead escolhe e passa o e-mail
  ctx.client.messages.create = (() => {
    const roteiro2 = [
      [uso('agendar_consultoria', { inicio: '2026-10-24T15:00:00.000Z', email: 'maria@exemplo.com' })],
      texto('Combinado, Maria! Deixei marcado e você vai receber a confirmação por e-mail.'),
    ];
    return async () => ({ content: roteiro2.shift() });
  })();
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'o das 12h, meu email é maria@exemplo.com' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();

  const post = chamadasSite.find((x) => x.opts?.method === 'POST');
  assert.ok(post, 'chamou /api/agendar');
  const corpo = JSON.parse(post.opts.body);
  assert.equal(corpo.email, 'maria@exemplo.com');
  assert.equal(corpo.whatsapp, '11912345678');
  assert.equal(corpo.inicio, '2026-10-24T15:00:00.000Z');
  assert.equal(ctx.store.leads.get(l.id).status, 'decidindo');
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /marcado/);
});

await teste('passar_para_gabriel: manda a mensagem, silencia o bot e avisa', async () => {
  const ctx = montar({
    roteiro: [[...texto('Vou pedir para o Gabriel continuar essa conversa com você pessoalmente, ele te responde por aqui.'), uso('passar_para_gabriel', { motivo: 'pediu desconto', resumo: 'Quer fechar com 8%.' })]],
  });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'faz por 8%?' });
  await ctx.bot.responder(c.id);
  assert.equal(ctx.store.conversas[0].estado, 'humano');
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /Gabriel/);
  const aviso = ctx.avisos.find((a) => a.tipo === 'Passou para você');
  assert.match(aviso.motivo, /pediu desconto/);

  // Novas mensagens do lead não geram resposta do bot
  const antes = ctx.wa.enviados.length;
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'e aí?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.wa.enviados.length, antes);
});

await teste('"pare": confirma, encerra e não responde mais', async () => {
  const ctx = montar();
  const l = lead();
  const c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'pare de me mandar mensagem' });
  ctx.bot.pararTimers();
  assert.equal(ctx.store.conversas[0].estado, 'optout');
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /não te envio mais/);
  assert.equal(ctx.store.leads.get(l.id).status, 'perdido');
  const antes = ctx.wa.enviados.length;
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi?' });
  assert.equal(ctx.wa.enviados.length, antes);
});

await teste('Gabriel responde à mão: o bot se cala e não atropela', async () => {
  const ctx = montar({ roteiro: [texto('Esta resposta não deve ser enviada.')] });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi' });
  await ctx.bot.aoHumano({ telefone: telefoneDe(c), texto: 'Oi, aqui é o Gabriel!' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.store.conversas[0].estado, 'humano');
  assert.equal(ctx.wa.enviados.length, 1); // só a abertura
  assert.equal(ctx.client.chamadas.length, 0);
});

await teste('quem não foi abordado pelo bot é ignorado', async () => {
  const ctx = montar();
  await ctx.bot.aoReceber({ telefone: '5511988887777', texto: 'oi, tudo bem?' });
  assert.equal(ctx.wa.enviados.length, 0);
  assert.equal(ctx.store.mensagens.length, 0);
});

await teste('áudio do lead: pede texto e avisa o Gabriel', async () => {
  const ctx = montar();
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: '', tipo: 'áudio' });
  ctx.bot.pararTimers();
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /só texto/);
  assert.ok(ctx.avisos.find((a) => a.tipo === 'Lead enviou mídia'));
});

await teste('falha do Claude: tenta de novo e, na 2ª vez, devolve a conversa ao Gabriel', async () => {
  const ctx = montar({ roteiro: [] }); // roteiro vazio → erro
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi' });
  await ctx.bot.responder(c.id); // 1ª falha: reagenda
  assert.equal(ctx.store.conversas[0].estado, 'ativa');
  await ctx.bot.responder(c.id); // 2ª falha
  ctx.bot.pararTimers();
  assert.equal(ctx.store.conversas[0].estado, 'humano');
  assert.ok(ctx.avisos.find((a) => a.tipo === 'Bot com falha técnica'));
});

await teste('economia pequena: o prompt enviado ao Claude proíbe oferecer reunião', async () => {
  const ctx = montar({ roteiro: [texto('Entendi. O que você quer resolver primeiro?')] });
  const c = await abrir(ctx, lead({ economia_estimada: 2386, percentual_reducao: 3 }));
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'exatamente' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.client.chamadas[0].system, /NÃO ofereça reunião/);
});


console.log('\nConhecimento');

await teste('pasta de conhecimento é carregada e os valores nela podem ser citados', () => {
  const k = carregarConhecimento();
  assert.ok(k.arquivos.length >= 3, 'leu os arquivos');
  assert.ok(!k.arquivos.some((f) => f.startsWith('_')), 'ignora arquivos que começam com _');
  assert.match(k.texto, /60 parcelas/);
  assert.ok(k.valores.includes(200) && k.valores.includes(500));
  const l = lead();
  const resposta = 'Dá para parcelar sim, em até 60 parcelas. A parcela mínima é de R$ 200 para pessoa física e R$ 500 para empresa.';
  assert.equal(validarSaida(resposta, l).ok, false, 'sem o conhecimento, os valores seriam bloqueados');
  assert.equal(validarSaida(resposta, l, k.valores).ok, true);
});

await teste('conhecimento vai para o prompt e a resposta sobre parcelamento sai', async () => {
  const resposta = 'Dá para parcelar sim. O saldo do INSS da obra pode ser parcelado em até 60 vezes, com parcela mínima de R$ 200 para pessoa física, e eu mesmo faço o parcelamento no final da obra.\n\nVocê está pensando em parcelar o INSS ou o honorário?';
  const ctx = montar({ roteiro: [texto(resposta)] });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'dá pra parcelar?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.client.chamadas[0].system, /CONHECIMENTO DO GABRIEL/);
  assert.match(ctx.client.chamadas[0].system, /50% no início do contrato/);
  assert.match(ctx.wa.enviados[1].texto, /60 vezes/);
  assert.equal(ctx.avisos.length, 0, 'sem e-mail quando o bot resolve sozinho');
});

await teste('pergunta fora do conhecimento: o prompt manda passar para o Gabriel em vez de inventar', () => {
  const s = montarSistema(lead(), config, carregarConhecimento().texto);
  assert.match(s, /NÃO invente: use passar_para_gabriel/);
  assert.match(s, /Nunca afirme ser uma pessoa/);
  assert.match(s, /Você é Lia, assistente do Gabriel/);
});

await teste('e-mail só quando você precisa agir', async () => {
  // Pedir para parar não gera e-mail
  const a = montar();
  const ca = await abrir(a, lead());
  await a.bot.aoReceber({ telefone: telefoneDe(ca), texto: 'pare' });
  assert.equal(a.avisos.length, 0);
  // Encerrar a conversa (lead sem interesse) não gera e-mail
  const b = montar({ roteiro: [[...texto('Tudo bem, obrigado pelo seu tempo.'), uso('encerrar_conversa', { motivo: 'sem interesse' })]] });
  const cb = await abrir(b, lead());
  await b.bot.aoReceber({ telefone: telefoneDe(cb), texto: 'não tenho interesse, obrigado' });
  await b.bot.responder(cb.id);
  b.bot.pararTimers();
  assert.equal(b.store.conversas[0].estado, 'encerrada');
  assert.equal(b.avisos.length, 0);
});

console.log(`\n${process.exitCode ? 'COM FALHAS' : 'Tudo certo'}: ${passou} testes passaram.\n`);
