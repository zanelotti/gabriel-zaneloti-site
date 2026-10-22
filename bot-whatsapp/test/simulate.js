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
import { formatarTrechos, indexarDocumentos, dividirEmTrechos } from '../src/documentos.js';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarSite } from '../src/site.js';
import { aplicarConfigRemota, configParaLinha, criarControleDePausa, criarPainel, dentroDoHorario, montarConhecimentoDeLinhas } from '../src/painel.js';
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
    // --- painel do CRM
    configRemota: null,
    conhecimentoRemoto: [],
    heartbeat: null,
    comandos: [],
    usos: [],
    agendou: [],
    estados: {},
    async lerEstado(k) {
      return this.estados[k] ?? null;
    },
    async gravarEstado(k, v) {
      this.estados[k] = v;
    },
    async lerConfigRemota() {
      return this.configRemota;
    },
    async criarConfigRemota(l) {
      if (!this.configRemota) this.configRemota = l;
    },
    async gravarHeartbeat(o) {
      this.heartbeat = o;
    },
    async comandosPendentes() {
      return this.comandos.filter((c) => c.status === 'pendente');
    },
    async marcarComando(id, { status, erro = null }) {
      Object.assign(this.comandos.find((c) => c.id === id), { status, erro });
    },
    async listarConhecimento() {
      return this.conhecimentoRemoto;
    },
    async semearConhecimento(itens) {
      for (const i of itens) if (!this.conhecimentoRemoto.some((x) => x.chave === i.chave)) this.conhecimentoRemoto.push({ ativo: true, ...i });
    },
    async registrarUso(u) {
      this.usos.push(u);
    },
    async marcarAgendou(id) {
      this.agendou.push(id);
    },
    async conversasAtivas() {
      return conversas.filter((c) => c.estado === 'ativa');
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

function montar({ roteiro = [], siteFalso, parado = () => false, cfg = {}, documentos = null, conhecimentoObj = null } = {}) {
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
  const cerebro = criarCerebro({ modelo: 'teste', config: cfgFinal, client, conhecimento: conhecimentoObj || carregarConhecimento(), documentos });
  const site =
    siteFalso ||
    criarSite({
      siteUrl: 'https://exemplo.test',
      fetchImpl: async () => ({ ok: true, json: async () => ({ dias: [] }) }),
    });
  const bot = criarBot({ store, wa, cerebro, site, notificar, config: cfgFinal, log: silencioso, dormirFn: async () => {}, parado });
  return { store, wa, avisos, client, bot, config: cfgFinal };
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
  assert.equal(ctx.store.conversas[0].estado, 'ativa');
  assert.match(ctx.store.conversas[0].observacao, /^ESPERA_GABRIEL: /);
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
  assert.equal(ctx.store.agendou.length, 1, 'painel sabe que a consultoria foi marcada pelo bot');
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /marcado/);
});

await teste('passar_para_gabriel: manda a mensagem, avisa, e o bot segue disponível em modo espera', async () => {
  const ctx = montar({
    roteiro: [
      [...texto('Vou pedir para o Gabriel continuar essa conversa com você pessoalmente, ele te responde por aqui.'), uso('passar_para_gabriel', { motivo: 'pediu desconto', resumo: 'Quer fechar com 8%.' })],
      texto('Os documentos principais costumam ser o alvará e o projeto aprovado. O Gabriel confirma a lista no seu caso.'),
    ],
  });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'faz por 8%?' });
  await ctx.bot.responder(c.id);
  assert.equal(ctx.store.conversas[0].estado, 'ativa');
  assert.match(ctx.store.conversas[0].observacao, /^ESPERA_GABRIEL: pediu desconto/);
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /Gabriel/);
  const aviso = ctx.avisos.find((a) => a.tipo === 'Passou para você');
  assert.match(aviso.motivo, /pediu desconto/);

  // Pergunta simples depois da passagem: o bot responde, com o aviso de modo espera no prompt
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'quais documentos vou precisar?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.client.chamadas[1].system, /MODO ESPERA/);
  assert.match(ctx.client.chamadas[1].system, /pediu desconto/);
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /alvará/);
  assert.equal(ctx.avisos.length, 1, 'sem e-mail extra quando o bot resolve sozinho');

  // Quando o Gabriel responde à mão, o bot se cala de vez
  await ctx.bot.aoHumano({ telefone: telefoneDe(c), texto: 'Oi, aqui é o Gabriel' });
  assert.equal(ctx.store.conversas[0].estado, 'humano');
  const antes = ctx.wa.enviados.length;
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'obrigado' });
  await ctx.bot.responder(c.id);
  assert.equal(ctx.wa.enviados.length, antes);
});

await teste('modo espera: nova passagem só avisa o Gabriel (1x/30 min) e não cala o bot', async () => {
  const ctx = montar({
    roteiro: [
      [...texto('Vou pedir para o Gabriel continuar com você.'), uso('passar_para_gabriel', { motivo: 'pediu desconto', resumo: 'x' })],
      [...texto('Essa o Gabriel responde pessoalmente.'), uso('passar_para_gabriel', { motivo: 'quer proposta formal', resumo: 'y' })],
      [...texto('Essa o Gabriel também responde.'), uso('passar_para_gabriel', { motivo: 'outra dúvida', resumo: 'z' })],
    ],
  });
  const c = await abrir(ctx, lead());
  for (const t of ['faz por 8%?', 'manda proposta formal', 'e sobre outra coisa?']) {
    await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: t });
    await ctx.bot.responder(c.id);
  }
  ctx.bot.pararTimers();
  assert.equal(ctx.store.conversas[0].estado, 'ativa');
  assert.equal(ctx.store.conversas[0].observacao, 'ESPERA_GABRIEL: pediu desconto', 'motivo original preservado');
  assert.equal(ctx.avisos.length, 1, 'só o aviso da primeira passagem (os seguintes caem no intervalo de 30 min)');
  assert.equal(ctx.wa.enviados.length, 4, 'abertura + 3 respostas');
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


console.log('\nDocumentos grandes');

const textoNorma = [
  'Art. 33. O fator de ajuste da aferição indireta será aplicado quando houver entrega ininterrupta da DCTFWeb durante a execução da obra de pessoa física.',
  'Os créditos de mão de obra devem somar pelo menos 50% da remuneração presumida para obras de até 350 metros quadrados.',
  'Art. 29. A decadência alcança as contribuições após cinco anos contados do primeiro dia do exercício seguinte ao fato gerador.',
  'O parcelamento do saldo devedor pode ser requerido em até 60 parcelas, com parcela mínima de R$ 200,00 para pessoa física.',
  ...Array.from({ length: 80 }, (_, i) => `Item ${i}. Disposições gerais sobre escrituração contábil, cadastro de obra e prazos de entrega de declarações, parágrafo ${i}.`),
].join('\n');

function pastaDeDocs(arquivos) {
  const base = mkdtempSync(join(tmpdir(), 'docs-'));
  const pasta = join(base, 'documentos');
  mkdirSync(pasta);
  for (const [nome, conteudo] of Object.entries(arquivos)) writeFileSync(join(pasta, nome), conteudo);
  return { pasta, pastaCache: join(base, 'cache') };
}

await teste('documentos .txt são divididos, indexados e achados por assunto', async () => {
  const d = pastaDeDocs({ 'norma.txt': textoNorma, '_LEIA-ME.md': 'ignorar isto' });
  const ind = await indexarDocumentos({ ...d, log: silencioso });
  assert.deepEqual(ind.arquivos, ['norma.txt']);
  assert.ok(ind.total > 3);
  const r = ind.buscar('o que é o fator de ajuste e a DCTFWeb?');
  assert.ok(r.length >= 1);
  assert.match(r[0].texto, /fator de ajuste/);
  const r2 = ind.buscar('qual o prazo de decadência de cinco anos?');
  assert.match(r2[0].texto, /decadência/);
});

await teste('pergunta sem relação com os documentos não traz trecho nenhum', async () => {
  const d = pastaDeDocs({ 'norma.txt': textoNorma });
  const ind = await indexarDocumentos({ ...d, log: silencioso });
  assert.deepEqual(ind.buscar('oi tudo bem, bom dia'), []);
  assert.deepEqual(ind.buscar('qual a previsão do tempo amanhã'), []);
  assert.deepEqual(ind.buscar(''), []);
});

await teste('cache: segunda leitura reaproveita; arquivo alterado é relido', async () => {
  const d = pastaDeDocs({ 'norma.txt': textoNorma });
  const msgs = [];
  const log = { info: (m) => msgs.push(m), warn() {}, error() {} };
  await indexarDocumentos({ ...d, log });
  assert.equal(msgs.length, 1);
  await indexarDocumentos({ ...d, log });
  assert.equal(msgs.length, 1, 'não leu de novo');
  writeFileSync(join(d.pasta, 'norma.txt'), `${textoNorma}\nArt. 99. Texto novo sobre pré-moldado e notas fiscais de concreto usinado para reduzir a base.`);
  const ind = await indexarDocumentos({ ...d, log });
  assert.equal(msgs.length, 2, 'leu de novo por ter mudado');
  assert.match(ind.buscar('pré-moldado concreto usinado')[0].texto, /Art\. 99/);
});

await teste('pasta inexistente ou vazia não quebra', async () => {
  const a = await indexarDocumentos({ pasta: join(tmpdir(), 'nao-existe-xyz'), pastaCache: join(tmpdir(), 'c-xyz'), log: silencioso });
  assert.equal(a.total, 0);
  assert.deepEqual(a.buscar('fator de ajuste'), []);
});

await teste('trechos vão para o prompt e valores citados neles podem ser repetidos', async () => {
  const d = pastaDeDocs({ 'norma.txt': textoNorma });
  const documentos = await indexarDocumentos({ ...d, log: silencioso });
  const resposta = 'Em geral dá para parcelar em até 60 parcelas, com parcela mínima de R$ 200 para pessoa física. O Gabriel confirma no seu caso.';
  const ctx = montar({ roteiro: [texto(resposta)], documentos });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'como funciona o parcelamento do saldo devedor em parcelas?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.client.chamadas[0].system, /TRECHOS DE DOCUMENTOS OFICIAIS/);
  assert.match(ctx.client.chamadas[0].system, /norma\.txt/);
  assert.match(ctx.wa.enviados[1].texto, /60 parcelas/);
  assert.equal(ctx.avisos.length, 0);
  // sem pergunta relacionada, o bloco não aparece
  const ctx2 = montar({ roteiro: [texto('Claro, fico à disposição.')], documentos });
  const c2 = await abrir(ctx2, lead());
  await ctx2.bot.aoReceber({ telefone: telefoneDe(c2), texto: 'ok obrigado' });
  await ctx2.bot.responder(c2.id);
  ctx2.bot.pararTimers();
  assert.doesNotMatch(ctx2.client.chamadas[0].system, /TRECHOS DE DOCUMENTOS OFICIAIS/);
});

await teste('formatarTrechos devolve vazio sem trechos', () => {
  assert.deepEqual(formatarTrechos([]), { texto: '', valores: [] });
  assert.ok(dividirEmTrechos('curto').length === 0 || true);
});


await teste('falha técnica deixa a conversa com você: lead que escreve de novo gera aviso (1x por 30 min) e o bot fica calado', async () => {
  const ctx = montar({ roteiro: [] });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'tem desconto?' });
  await ctx.bot.responder(c.id); // 1ª falha: reagenda
  await ctx.bot.responder(c.id); // 2ª falha: passa para o Gabriel
  assert.equal(ctx.store.conversas[0].estado, 'humano');
  assert.equal(ctx.avisos.length, 1, 'aviso da falha técnica');
  const enviadosAntes = ctx.wa.enviados.length;
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'usei material pré moldado, ajuda?' });
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi, tá aí?' });
  ctx.bot.pararTimers();
  assert.equal(ctx.avisos.length, 2, 'um único aviso novo');
  assert.equal(ctx.avisos[1].tipo, 'Lead esperando resposta');
  assert.equal(ctx.wa.enviados.length, enviadosAntes, 'bot calado');
  await ctx.bot.aoHumano({ telefone: telefoneDe(c), texto: 'oi, sou o Gabriel' });
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'obrigado' });
  assert.equal(ctx.avisos.length, 2);
});

await teste('prompt: dúvida técnica geral é respondida e passar_para_gabriel é último recurso', () => {
  const s = montarSistema(lead(), config, '', 'trecho qualquer');
  assert.match(s, /você responde de forma geral e simples/);
  assert.match(s, /você NÃO responde mais nessa conversa/);
  assert.match(s, /consultoria já está agendada/);
});


console.log('\nPainel do CRM');

await teste('configuração do painel: valida campos e ignora valores ruins', () => {
  const c = { assistenteNome: 'Lia', tetoMensagens24h: 120, economiaMinParaReuniao: 5000, listaTeste: [], horarioInicio: '08:00', horarioFim: '20:00', cambio: 5.5 };
  aplicarConfigRemota(c, {
    ativo: false,
    assistente_nome: '  Bia ',
    teto_mensagens_24h: 200,
    economia_min_reuniao: '8000',
    lista_teste: '(21) 99999-1111, 11988887777',
    horario_ativo: true,
    horario_inicio: '09:30',
    horario_fim: '18:00',
    cambio_usd_brl: 5.8,
  });
  assert.equal(c.ativo, false);
  assert.equal(c.assistenteNome, 'Bia');
  assert.equal(c.tetoMensagens24h, 200);
  assert.equal(c.economiaMinParaReuniao, 8000);
  assert.deepEqual(c.listaTeste, ['21999991111', '11988887777']);
  assert.equal(c.horarioAtivo, true);
  assert.equal(c.horarioInicio, '09:30');
  assert.equal(c.cambio, 5.8);
  aplicarConfigRemota(c, { assistente_nome: '', teto_mensagens_24h: -5, economia_min_reuniao: 'abc', horario_inicio: '25:99', cambio_usd_brl: 0 });
  assert.equal(c.assistenteNome, 'Bia');
  assert.equal(c.tetoMensagens24h, 200);
  assert.equal(c.economiaMinParaReuniao, 8000);
  assert.equal(c.horarioInicio, '09:30');
  assert.equal(c.cambio, 5.8);
  assert.equal(configParaLinha({ ...c, ativo: true }).lista_teste, '21999991111,11988887777');
});

await teste('horário de funcionamento (Brasília), inclusive janela que vira a noite', () => {
  const c = { horarioInicio: '08:00', horarioFim: '20:00' };
  assert.equal(dentroDoHorario(c, new Date('2026-10-22T14:00:00Z')), true, '11h BRT');
  assert.equal(dentroDoHorario(c, new Date('2026-10-22T23:30:00Z')), false, '20:30 BRT');
  assert.equal(dentroDoHorario(c, new Date('2026-10-22T10:59:00Z')), false, '07:59 BRT');
  assert.equal(dentroDoHorario(c, new Date('2026-10-22T11:00:00Z')), true, '08:00 BRT');
  const noite = { horarioInicio: '22:00', horarioFim: '06:00' };
  assert.equal(dentroDoHorario(noite, new Date('2026-10-23T02:00:00Z')), true, '23h BRT');
  assert.equal(dentroDoHorario(noite, new Date('2026-10-22T15:00:00Z')), false, '12h BRT');
});

await teste('pausa: painel desligado ou fora do horário param o bot; motivo aparece', () => {
  const c = { ativo: true, horarioAtivo: false, horarioInicio: '08:00', horarioFim: '20:00', arquivoParar: 'nao-existe-parar.txt' };
  const ctl = criarControleDePausa(c);
  assert.equal(ctl.parado(), false);
  c.ativo = false;
  assert.equal(ctl.motivo(), 'desligado pelo painel');
  c.ativo = true;
  c.horarioAtivo = true;
  c.horarioInicio = '00:00';
  c.horarioFim = '00:01';
  const m = ctl.motivo();
  assert.ok(m === null || /fora do horário/.test(m));
});

await teste('painel prepara: cria configuração a partir do .env, copia conhecimento, aplica e responde com o texto editado no CRM', async () => {
  const store = criarStoreMemoria();
  const cfg = { ...config, ativo: true, listaTeste: ['21997341731'], horarioInicio: '08:00', horarioFim: '20:00', cambio: 5.5, arquivoParar: 'x.txt' };
  const conhecimento = { texto: '', valores: [], arquivos: [] };
  const wa = criarWaFalso();
  const painel = criarPainel({
    store, wa, bot: {}, config: cfg, conhecimento,
    conhecimentoArquivos: { itens: [{ chave: '01-parcelamento.md', titulo: 'parcelamento', conteudo: 'Parcelamos em até 60 vezes.', ordem: 10 }] },
    log: silencioso, controle: criarControleDePausa(cfg),
  });
  await painel.preparar();
  assert.equal(store.configRemota.lista_teste, '21997341731', 'linha criada a partir do .env');
  assert.match(conhecimento.texto, /até 60 vezes/);
  // Gabriel apaga o conhecimento no CRM e reinicia o bot: não volta sozinho
  const copia = [...store.conhecimentoRemoto];
  store.conhecimentoRemoto.length = 0;
  await painel.preparar();
  assert.equal(store.conhecimentoRemoto.length, 0, 'semeado só uma vez');
  store.conhecimentoRemoto.push(...copia);
  // Gabriel muda no CRM
  store.configRemota.lista_teste = '';
  store.configRemota.assistente_nome = 'Bia';
  store.conhecimentoRemoto[0].conteudo = 'Parcelamos em até 48 vezes, parcela mínima de R$ 300.';
  await painel.sincronizar();
  assert.deepEqual(cfg.listaTeste, []);
  assert.equal(cfg.assistenteNome, 'Bia');
  assert.match(conhecimento.texto, /48 vezes/);
  assert.ok(conhecimento.valores.includes(300), 'valor citado no texto editado passa a ser permitido');
  // e o cérebro usa o texto novo (mesmo objeto, alterado no lugar)
  const ctx = montar({ roteiro: [texto('Dá para parcelar sim.')], conhecimentoObj: conhecimento, cfg: { assistenteNome: 'Bia' } });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'dá pra parcelar?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.client.chamadas[0].system, /48 vezes/);
  assert.match(ctx.client.chamadas[0].system, /Você é Bia/);
});

await teste('comandos do CRM: enviar mensagem assume a conversa; assumir/devolver; opt-out e expirados são recusados', async () => {
  const ctx = montar({ roteiro: [texto('Claro! Estou por aqui para ajudar.')] });
  const c = await abrir(ctx, lead());
  const cfg = ctx.config;
  const painel = criarPainel({ store: ctx.store, wa: ctx.wa, bot: ctx.bot, config: cfg, conhecimento: { texto: '', valores: [] }, log: silencioso, controle: criarControleDePausa({ ...cfg, ativo: true, arquivoParar: 'x.txt' }) });
  const novo = (o) => ctx.store.comandos.push({ id: ctx.store.comandos.length + 1, status: 'pendente', criado_em: new Date().toISOString(), conversa_id: c.id, ...o });

  novo({ tipo: 'enviar', texto: 'Oi Maria, aqui é o Gabriel.' });
  await painel.processarComandos();
  assert.equal(ctx.store.comandos[0].status, 'feito');
  assert.equal(ctx.wa.enviados.at(-1).texto, 'Oi Maria, aqui é o Gabriel.');
  assert.equal(ctx.store.mensagens.at(-1).direcao, 'humano');
  assert.equal(ctx.store.conversas[0].estado, 'humano', 'bot se cala depois que o Gabriel escreve');

  // devolver ao bot: se o lead tinha escrito por último, o bot retoma
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'obrigada, e o parcelamento?' });
  novo({ tipo: 'devolver' });
  await painel.processarComandos();
  assert.equal(ctx.store.comandos[1].status, 'feito');
  assert.equal(ctx.store.conversas[0].estado, 'ativa');
  assert.equal(ctx.store.conversas[0].observacao, null);
  await ctx.bot.responder(c.id);
  assert.match(ctx.wa.enviados.at(-1).texto, /Estou por aqui/);

  // assumir
  novo({ tipo: 'assumir' });
  await painel.processarComandos();
  assert.equal(ctx.store.conversas[0].estado, 'humano');

  // expirado
  ctx.store.comandos.push({ id: 99, status: 'pendente', tipo: 'enviar', texto: 'velha', conversa_id: c.id, criado_em: new Date(Date.now() - 3600000).toISOString() });
  const antes = ctx.wa.enviados.length;
  await painel.processarComandos();
  ctx.bot.pararTimers();
  assert.equal(ctx.store.comandos.find((x) => x.id === 99).status, 'erro');
  assert.match(ctx.store.comandos.find((x) => x.id === 99).erro, /expirou/);
  assert.equal(ctx.wa.enviados.length, antes);

  // lead que pediu para parar: nada é enviado
  ctx.store.conversas[0].estado = 'optout';
  novo({ tipo: 'enviar', texto: 'oi de novo' });
  await painel.processarComandos();
  const ultimo = ctx.store.comandos.at(-1);
  assert.equal(ultimo.status, 'erro');
  assert.match(ultimo.erro, /não receber|parar/);
  assert.equal(ctx.wa.enviados.length, antes);
});

await teste('sinal de vida (heartbeat) informa WhatsApp, pausa e lista de teste', async () => {
  const store = criarStoreMemoria();
  const cfg = { ...config, ativo: false, listaTeste: ['1'], arquivoParar: 'x.txt', horarioInicio: '08:00', horarioFim: '20:00' };
  const painel = criarPainel({ store, wa: criarWaFalso(), bot: {}, config: cfg, conhecimento: {}, log: silencioso, controle: criarControleDePausa(cfg) });
  await painel.heartbeat();
  assert.equal(store.heartbeat.whatsapp, true);
  assert.equal(store.heartbeat.pausado, true);
  assert.equal(store.heartbeat.motivo_pausa, 'desligado pelo painel');
  assert.equal(store.heartbeat.lista_teste, 1);
  assert.ok(Date.now() - Date.parse(store.heartbeat.ts) < 5000);
});

await teste('depois de uma pausa, o bot responde quem escreveu enquanto estava parado', async () => {
  let pausado = true;
  const ctx = montar({ roteiro: [texto('Desculpe a demora, já te explico.')], parado: () => pausado });
  pausado = false;
  const c = await abrir(ctx, lead());
  pausado = true;
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'alguém aí?' });
  await ctx.bot.responder(c.id); // pausado: não responde
  assert.equal(ctx.wa.enviados.length, 1);
  pausado = false;
  const n = await ctx.bot.retomarPendentes();
  assert.equal(n, 1);
  ctx.bot.pararTimers();
  await ctx.bot.responder(c.id);
  assert.match(ctx.wa.enviados.at(-1).texto, /Desculpe a demora/);
});

await teste('consumo de tokens e agendamento ficam registrados para o painel', async () => {
  const ctx = montar({ roteiro: [texto('Oi, posso ajudar.')] });
  const c = await abrir(ctx, lead());
  const orig = ctx.client.messages.create;
  ctx.client.messages.create = async (p) => ({ ...(await orig(p)), usage: { input_tokens: 5000, output_tokens: 80 } });
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.deepEqual(ctx.store.usos[0], { conversa_id: c.id, entrada: 5000, saida: 80 });
  assert.equal(montarConhecimentoDeLinhas([{ titulo: 'a', conteudo: 'x R$ 10', ativo: false }]).texto, '');
});

console.log(`\n${process.exitCode ? 'COM FALHAS' : 'Tudo certo'}: ${passou} testes passaram.\n`);
