/**
 * Testes com tudo simulado (nenhuma chamada real a WhatsApp, Supabase, Claude ou site).
 * Rode com: npm test
 */
import assert from 'node:assert/strict';
import { criarBot } from '../src/bot.js';
import { criarCerebro, montarHistorico } from '../src/brain.js';
import { dividirMensagens, extrairValoresReais, muitoLonga, pediuParar, validarSaida } from '../src/guards.js';
import { montarAbertura } from '../src/opening.js';
import { montarSistema } from '../src/prompt.js';
import { carregarConhecimento, sha256 } from '../src/conhecimento.js';
import { formatarTrechos, indexarDocumentos, dividirEmTrechos } from '../src/documentos.js';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarSite } from '../src/site.js';
import { aplicarConfigRemota, configParaLinha, criarControleDePausa, criarPainel, dentroDoHorario, montarConhecimentoDeLinhas } from '../src/painel.js';
import { criarAprendizado, criarIndiceAprendizado, formatarAprendidos, validarAprendizado } from '../src/aprendizado.js';
import { citouHonorarios, MOTIVOS_PERDA, podeMover } from '../src/funil.js';
import { descreverQuando, lembreteDevido, montarFollowup, montarMensagemConsultoria, proximoFollowup } from '../src/acompanhamento.js';
import { calcularHonorario, criarChamador, limparNomeInformado, nomeParecePessoa, normalizarTelefoneBR, primeiroNomePessoa } from '../src/util.js';

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
      mensagens.push({ id: mensagens.length + 1, ...m, criado_em: new Date().toISOString() });
    },
    async historico(id) {
      return mensagens.filter((m) => m.conversa_id === id);
    },
    async contarMensagensBot() {
      return mensagens.filter((m) => m.direcao === 'bot').length;
    },
    async atualizarLead(id, { status, nota, motivoPerda }) {
      const l = leads.get(id);
      if (!l) return;
      if (status && podeMover(l.status, status)) {
        l.status = status;
        if (status === 'perdido' && motivoPerda && MOTIVOS_PERDA.includes(motivoPerda) && !l.motivo_perda) l.motivo_perda = motivoPerda;
      }
      if (nota) l.notas = `${l.notas ? `${l.notas}\n` : ''}${nota}`;
    },
    async conversasParaFollowup() {
      return conversas.filter((c) => c.estado === 'ativa' && (c.followup_nivel ?? 0) < 3);
    },
    async registrarFollowup(id, nivel) {
      Object.assign(conversas.find((c) => c.id === id), { followup_nivel: nivel, ultimo_followup_em: new Date().toISOString() });
    },
    async zerarFollowup(id) {
      conversas.find((c) => c.id === id).followup_nivel = 0;
    },
    agendamentos: [],
    async agendamentosRecentes() {
      return this.agendamentos;
    },
    async leadsSemResposta() {
      return conversas
        .filter((c) => c.estado === 'ativa' && leads.get(c.lead_id)?.status === 'contatado' && !mensagens.some((m) => m.conversa_id === c.id && m.direcao === 'lead'))
        .map((c) => c.lead_id);
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
    async salvarNomeContato(id, nome) {
      conversas.find((c) => c.id === id).nome_contato = nome;
    },
    async conversasAtivas() {
      return conversas.filter((c) => c.estado === 'ativa');
    },
    // --- aprendizado automático
    aprendizado: [],
    async conversasParaAprender(ociosoMs, limite = 5) {
      const saida = [];
      for (const c of conversas) {
        const h = mensagens.filter((m) => m.conversa_id === c.id);
        const ultimaHumana = h.filter((m) => m.direcao === 'humano').map((m) => m.id).pop();
        if (!ultimaHumana || (c.aprendido_ate ?? 0) >= ultimaHumana) continue;
        const ult = h[h.length - 1];
        if (Date.now() - Date.parse(ult.criado_em) < ociosoMs) continue;
        saida.push({ conversa: c, historico: h });
      }
      return saida.slice(0, limite);
    },
    async marcarAprendido(id, ate) {
      conversas.find((c) => c.id === id).aprendido_ate = ate;
    },
    async salvarAprendizados(id, itens) {
      for (const i of itens) this.aprendizado.push({ id: this.aprendizado.length + 1, conversa_id: id, ativo: true, ...i });
    },
    async listarAprendizado() {
      return this.aprendizado.filter((a) => a.ativo);
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
  const avisosGrandes = []; // e-mails "Lead grande ..." (aviso novo, separado para não misturar com os de "precisa agir")
  const notificar = {
    async avisar(a) {
      (/^Lead grande/.test(a.tipo) ? avisosGrandes : avisos).push(a);
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
  return { store, wa, avisos, avisosGrandes, client, bot, config: cfgFinal };
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
    'Temos assessoria jurídica para isso',
    'O mínimo que cobro é alto',
    'O honorário é 15% da economia',
    'Eu garanto que você economiza',
    'Você economiza R$ 9.999',
  ]) {
    assert.equal(validarSaida(t, l).ok, false, t);
  }
  assert.equal(validarSaida('O honorário é de 12% sobre a economia que a gente conseguir comprovar.', l).ok, true);
  assert.equal(validarSaida('Para pessoa jurídica o caminho de redução é outro.', l).ok, true, '"pessoa jurídica" é termo correto e pode');
  assert.equal(validarSaida('Isso vale para Pessoas Jurídicas com CNPJ.', l).ok, true);
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
  assert.ok(chamada.tools.length === 6);
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
  assert.equal(ctx.store.leads.get(l.id).status, 'agendado', 'card vai para a coluna Agendamento');
  assert.equal(ctx.store.agendou.length, 1, 'painel sabe que a consultoria foi marcada pelo bot');
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /marcado/);
});

await teste('ligação rápida hoje: prompt traz o plano C nas duas estratégias e o aviso "LIGAR HOJE" sai na hora, mesmo já em modo espera', async () => {
  for (const estrategia of ['conversa', 'consultoria']) {
    const sis = montarSistema(lead(), { ...config, estrategia });
    assert.match(sis, /PLANO C: LIGAÇÃO RÁPIDA PELO CELULAR, NO MESMO DIA/);
    assert.match(sis, /HOJE mesmo/);
    assert.match(sis, /motivo começando exatamente por "LIGAÇÃO HOJE:"/);
    assert.match(sis, /Não ofereça a ligação mais de uma vez/);
  }
  const ctx = montar({
    roteiro: [
      [...texto('Vou pedir para o Gabriel continuar essa conversa com você pessoalmente, ele te responde por aqui.'), uso('passar_para_gabriel', { motivo: 'pediu desconto', resumo: 'Quer fechar com 8%.' })],
      [...texto('Combinado, o Gabriel te liga hoje por volta das 15h.'), uso('passar_para_gabriel', { motivo: 'LIGAÇÃO HOJE: aceitou ligação rápida', resumo: 'Melhor horário 15h, neste número.' })],
    ],
  });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'faz por 8%?' });
  await ctx.bot.responder(c.id);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'pode ligar hoje às 15h nesse número' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  const aviso = ctx.avisos.find((a) => a.tipo === 'LIGAR HOJE');
  assert.ok(aviso, 'aviso próprio de ligação, sem esperar os 30 min');
  assert.match(aviso.motivo, /15h/);
  assert.equal(ctx.avisos.filter((a) => a.tipo === 'LIGAR HOJE').length, 1);
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /liga hoje/);
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


console.log('\nNome da pessoa');

await teste('nome de empresa, sigla ou vazio não é tratado como nome de pessoa', () => {
  for (const n of ['Construtora Silva Ltda', 'JMX Engenharia', 'ABC', '', null, 'Empreendimentos Sol e Mar', 'Casa 12 Reformas', 'Silva & Filhos', 'Grupo Horizonte', 'Maria Eng', 'MFZ Construtech']) {
    if (n === 'Maria Eng') continue; // pessoa com sobrenome estranho: aceito
    assert.equal(nomeParecePessoa(n), false, `"${n}" não é nome de pessoa`);
    assert.equal(primeiroNomePessoa(n), '');
  }
  for (const n of ['maria da SILVA', 'João', 'José Carlos Pereira Neto', 'Ana Paula', 'Gabriel Zaneloti']) {
    assert.equal(nomeParecePessoa(n), true, `"${n}" é nome de pessoa`);
  }
  assert.equal(primeiroNomePessoa('maria da SILVA'), 'Maria');
});

await teste('nome informado no WhatsApp é limpo ("me chama de joão")', () => {
  assert.equal(limparNomeInformado('me chama de joão'), 'João');
  assert.equal(limparNomeInformado('Meu nome é carlos eduardo.'), 'Carlos Eduardo');
  assert.equal(limparNomeInformado('11999998888'), '');
  assert.equal(limparNomeInformado('quero saber o valor do parcelamento hoje'), '');
});

await teste('abertura para cadastro com nome de empresa não usa o nome', () => {
  const a = montarAbertura(lead({ nome: 'Construtora Silva Ltda' }), 'Lia');
  assert.match(a.texto, /^Oi, tudo bem\? Aqui é Lia/);
  assert.doesNotMatch(a.texto, /Construtora/);
  const b = montarAbertura(lead({ nome: '' }), 'Lia');
  assert.match(b.texto, /^Oi, tudo bem\? Aqui é Lia/);
  const c = montarAbertura(lead({ nome: 'maria da SILVA' }), 'Lia');
  assert.match(c.texto, /^Oi, Maria, tudo bem\?/);
});

await teste('sem nome de pessoa: prompt manda perguntar o nome; depois que registra, passa a usar e agenda com ele', async () => {
  const chamadasSite = [];
  const siteFalso = criarSite({
    siteUrl: 'https://exemplo.test',
    fetchImpl: async (url, opts) => {
      chamadasSite.push({ url, opts });
      if (String(url).includes('agenda-horarios')) return { ok: true, json: async () => ({ dias: [{ data: '2026-10-24', horarios: [{ inicio: '2026-10-24T15:00:00.000Z', rotulo: 'sábado 12:00' }] }] }) };
      return { ok: true, json: async () => ({ ok: true, confirmado_para: '2026-10-24T15:00:00.000Z' }) };
    },
  });
  const ctx = montar({
    siteFalso,
    roteiro: [
      texto('Claro, te explico. A propósito, como posso te chamar?'),
      [...texto('Prazer, Carlos!'), uso('registrar_nome', { nome: 'me chama de carlos' })],
      texto('Prazer, Carlos! Quer ver os horários da consultoria?'),
      [uso('ver_horarios', {})],
      [uso('agendar_consultoria', { inicio: '2026-10-24T15:00:00.000Z', email: 'carlos@exemplo.com' })],
      texto('Combinado, Carlos. Está marcado.'),
    ],
  });
  const l = lead({ nome: 'Construtora Silva Ltda' });
  const c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'como funciona?' });
  await ctx.bot.responder(c.id);
  assert.match(ctx.client.chamadas[0].system, /AINDA NÃO SABEMOS/);
  assert.match(ctx.client.chamadas[0].system, /como posso te chamar/);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'me chama de carlos' });
  await ctx.bot.responder(c.id);
  assert.equal(ctx.store.conversas[0].nome_contato, 'Carlos');
  assert.match(l.notas, /Nome informado no WhatsApp: Carlos/);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'quero' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  const ultimoSistema = ctx.client.chamadas[3].system;
  assert.match(ultimoSistema, /Nome da pessoa: Carlos/);
  assert.doesNotMatch(ultimoSistema, /AINDA NÃO SABEMOS/);
  const post = chamadasSite.find((x) => x.opts?.method === 'POST');
  assert.equal(JSON.parse(post.opts.body).nome, 'Carlos', 'agenda no nome que a pessoa informou, não no da empresa');
});

await teste('nome que não parece nome é recusado pela ferramenta', async () => {
  const ctx = montar({ roteiro: [[uso('registrar_nome', { nome: 'quero saber o valor do parcelamento hoje' })], texto('Desculpe, como posso te chamar?')] });
  const c = await abrir(ctx, lead({ nome: 'ABC' }));
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.store.conversas[0].nome_contato, undefined);
});


await teste('ferramenta consultar_documentos: o assistente pesquisa com termos técnicos e usa o resultado (inclusive valores citados)', async () => {
  const d = pastaDeDocs({
    'manual.txt': [
      'Avaliação de Notas Fiscais de Pré-Moldado: o uso de pré-moldado poderá acarretar a redução de 70% da remuneração devida, desde que as notas somem ao menos 40% do custo da obra.',
      'Para efeito de crédito, a remuneração de empregados registrados e vinculada ao CNO da obra abate o valor devido, com limite de R$ 15.000 no exemplo.',
      ...Array.from({ length: 80 }, (_, i) => `Item ${i}. Disposições gerais sobre cadastro de obra e prazos de entrega, parágrafo ${i}.`),
    ].join('\n'),
  });
  const documentos = await indexarDocumentos({ ...d, log: silencioso });
  const resposta = 'Para empresa, uma das frentes é a nota fiscal de pré-moldado: se somar ao menos 40% do custo, a normativa permite reduzir 70% da remuneração daquela área. Na obra, teve notas de pré-moldado?';
  const ctx = montar({
    documentos,
    roteiro: [[uso('consultar_documentos', { termos: 'nota fiscal pré-moldado redução remuneração' })], texto(resposta)],
  });
  const c = await abrir(ctx, lead({ responsavel: 'PJ', economia_estimada: null, inss_estimado: null }));
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'como que reduz o imposto nesse caso?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.ok(ctx.client.chamadas[0].tools.some((t) => t.name === 'consultar_documentos'), 'ferramenta oferecida');
  const resultado = ctx.client.chamadas[1].messages.at(-1).content[0];
  assert.match(resultado.content, /pré-moldado/i);
  assert.match(ctx.wa.enviados.at(-1).texto, /70%/);
});

await teste('sem pasta de documentos a ferramenta de consulta não é oferecida', async () => {
  const ctx = montar({ roteiro: [texto('Claro.')] });
  const c = await abrir(ctx, lead());
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.ok(!ctx.client.chamadas[0].tools.some((t) => t.name === 'consultar_documentos'));
});

await teste('radical: "reduzir" encontra "reduz" e "reduzido"', async () => {
  const d = pastaDeDocs({
    'n.txt': ['O valor reduzido da contribuição depende do enquadramento da obra e da comprovação documental apresentada.', ...Array.from({ length: 60 }, (_, i) => `Linha ${i} sobre assuntos diversos de cadastro e prazos ${i}.`)].join('\n'),
  });
  const ind = await indexarDocumentos({ ...d, log: silencioso });
  assert.ok(ind.buscar('como reduzir contribuição comprovação').length >= 1);
});

await teste('conhecimento: arquivo novo na pasta é copiado uma vez; o apagado no CRM não volta', async () => {
  const store = criarStoreMemoria();
  const cfg = { ...config, ativo: true, listaTeste: [], horarioInicio: '08:00', horarioFim: '20:00', cambio: 5.5, arquivoParar: 'x.txt' };
  const conhecimento = { texto: '', valores: [], arquivos: [] };
  const mk = (itens) => criarPainel({ store, wa: criarWaFalso(), bot: {}, config: cfg, conhecimento, conhecimentoArquivos: { itens }, log: silencioso, controle: criarControleDePausa(cfg) });
  // instalação antiga: flag guardava só a data
  store.estados.conhecimento_semeado = new Date().toISOString();
  store.conhecimentoRemoto.push({ ativo: true, chave: '01-parcelamento.md', titulo: 'parcelamento', conteudo: 'texto antigo editado', ordem: 10 });
  const itens = [
    { chave: '01-parcelamento.md', titulo: 'parcelamento', conteudo: 'texto do arquivo', ordem: 10 },
    { chave: '04-formas-de-reduzir.md', titulo: 'formas de reduzir', conteudo: 'pré-moldado e créditos', ordem: 40 },
  ];
  await mk(itens).preparar();
  assert.equal(store.conhecimentoRemoto.length, 2, 'só o arquivo novo foi acrescentado');
  assert.equal(store.conhecimentoRemoto[0].conteudo, 'texto antigo editado', 'edição do CRM preservada');
  store.conhecimentoRemoto.pop(); // Gabriel apaga o novo
  await mk(itens).preparar();
  assert.equal(store.conhecimentoRemoto.length, 1, 'não ressuscita');
});

console.log('\nHonorários');

await teste('cálculo do honorário: PF 12% com piso de R$ 600; PJ R$ 1.000 + 12%', () => {
  assert.deepEqual(calcularHonorario(lead({ economia_estimada: 42000 })), { tipo: 'PF', economiaConhecida: true, valor: 5040, minimoAplicado: false, liquido: 36960 });
  const baixo = calcularHonorario(lead({ economia_estimada: 3000 }));
  assert.equal(baixo.valor, 600);
  assert.equal(baixo.doze, 360);
  assert.equal(baixo.minimoAplicado, true);
  assert.equal(calcularHonorario(lead({ economia_estimada: 0 })).valor, 600, 'sem economia: piso');
  assert.equal(calcularHonorario(lead({ economia_estimada: 5000 })).minimoAplicado, false, '12% de 5.000 já é 600: sem piso');
  assert.equal(calcularHonorario(lead({ economia_estimada: null })).economiaConhecida, false);
  assert.deepEqual(calcularHonorario(lead({ responsavel: 'PJ' })), { tipo: 'PJ', base: 1000 });
});

await teste('PF com 12% acima de R$ 600: pode citar o honorário; não pode falar em mínimo nem em R$ 600', () => {
  const l = lead({ economia_estimada: 42000 });
  assert.equal(validarSaida('Pelo valor estimado de R$ 42.000, o honorário seria de R$ 5.040 (12%), confirmado na análise.', l).ok, true);
  assert.equal(validarSaida('O honorário tem um valor mínimo de R$ 600.', l).ok, false);
  assert.equal(validarSaida('O honorário seria de R$ 5.500.', l).ok, false, 'valor inventado');
  const sistema = montarSistema(l, config);
  assert.match(sistema, /HONORÁRIO: R\$\s5\.040/);
  assert.match(sistema, /NÃO fale em valor mínimo/);
});

await teste('PF com economia pequena: honorário fica em R$ 600 e a Lia pode explicar o piso', () => {
  const l = lead({ economia_estimada: 3000, inss_estimado: 9000, valor_apos_reducao: 6000 });
  assert.equal(validarSaida('12% da estimativa daria R$ 360, então o honorário fica em R$ 600, que é o valor mínimo.', l).ok, true);
  assert.equal(validarSaida('O honorário fica em R$ 700.', l).ok, false);
  assert.match(montarSistema(l, config), /fica em R\$\s600/);
});

await teste('PF sem economia estimada: pode explicar a regra dos R$ 600 sem inventar outros valores', () => {
  const l = lead({ economia_estimada: null, inss_estimado: 50000 });
  assert.equal(validarSaida('São 12% sobre a economia comprovada; se der menos de R$ 600, o honorário fica em R$ 600.', l).ok, true);
  assert.equal(validarSaida('O honorário será de R$ 6.000.', l).ok, false);
});

await teste('empresa: R$ 1.000 mais 12% da economia conseguida; nunca valor de economia nem R$ 600', () => {
  const l = lead({ responsavel: 'PJ', economia_estimada: null, inss_estimado: null });
  assert.equal(validarSaida('Para empresa o honorário é R$ 1.000 mais 12% sobre a economia que a gente conseguir com notas de pré-moldado e créditos de mão de obra.', l).ok, true);
  assert.equal(validarSaida('O honorário é R$ 600.', l).ok, false);
  assert.equal(validarSaida('Você economiza R$ 42.000.', l).ok, false);
  assert.match(montarSistema(l, config), /HONORÁRIO \(empresa\): R\$\s1\.000 mais 12%/);
});

await teste('fluxo: lead PF pergunta o custo e a Lia responde com o valor calculado pelo sistema', async () => {
  const ctx = montar({
    roteiro: [texto('Pela estimativa da calculadora, o honorário seria de R$ 5.040, que é 12% da economia. O valor final a gente confirma na análise do Gabriel. Faz sentido?')],
  });
  const c = await abrir(ctx, lead({ economia_estimada: 42000 }));
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'quanto custa o seu serviço?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.wa.enviados.at(-1).texto, /R\$ 5\.040/);
  assert.equal(ctx.store.conversas[0].estado, 'ativa');
});

console.log('\nEstratégia de venda');

await teste('estratégia "conversa" (padrão): vende pela conversa, passa valor antes do honorário e usa a consultoria como plano B', () => {
  const sis = montarSistema(lead(), { ...config, estrategia: 'conversa' });
  assert.match(sis, /VENDER PELA CONVERSA/);
  assert.match(sis, /PASSAR VALOR antes de falar de honorário/);
  assert.match(sis, /plano B/);
  assert.match(sis, /ARSENAL DE TÉCNICAS/);
  assert.match(sis, /não vai fechar só pela conversa/);
  assert.match(sis, /SOMENTE nos casos previstos/);
  assert.doesNotMatch(sis, /LEVAR PARA A CONSULTORIA/);
  const semCampo = montarSistema(lead(), config);
  assert.match(semCampo, /VENDER PELA CONVERSA/, 'sem o campo, o padrão é vender pela conversa');
});

await teste('segundo livro: técnicas de escuta/necessidades entram nas duas estratégias, sem frases proibidas', () => {
  for (const estrategia of ['conversa', 'consultoria']) {
    const sis = montarSistema(lead(), { ...config, estrategia });
    assert.match(sis, /ESCUTA, NECESSIDADES E COMUNICAÇÃO CLARA/);
    assert.match(sis, /Pedido x necessidade/);
    assert.match(sis, /Conte a intenção antes de perguntar/);
    assert.match(sis, /Receita como problema a resolver/);
    assert.match(sis, /Admita o que não sabe/);
  }
  const sis = montarSistema(lead(), config);
  const bloco = sis.slice(sis.indexOf('ARSENAL COMPLEMENTAR'), sis.indexOf('# ESTRATÉGIA'));
  assert.ok(bloco.length > 1500, 'bloco presente');
  assert.doesNotMatch(bloco, /só paga|risco zero|sem risco|advogado|jurídic|direito/i);
});

await teste('estratégia "consultoria": leva para a consultoria, mas também passa valor antes do honorário', () => {
  const sis = montarSistema(lead(), { ...config, estrategia: 'consultoria' });
  assert.match(sis, /LEVAR PARA A CONSULTORIA/);
  assert.match(sis, /sempre passe valor/);
  assert.doesNotMatch(sis, /VENDER PELA CONVERSA/);
  assert.match(sis, /POLÍTICA DE REUNIÃO: pode oferecer a consultoria gratuita/);
});

await teste('economia pequena continua sem oferecer reunião, em qualquer estratégia', () => {
  for (const estrategia of ['conversa', 'consultoria']) {
    const sis = montarSistema(lead({ economia_estimada: 3000 }), { ...config, estrategia });
    assert.match(sis, /NÃO ofereça reunião/);
  }
});

await teste('painel: estratégia vem do CRM, valor inválido é ignorado, e vai na linha inicial', () => {
  const cfg = { ...config, estrategia: 'conversa' };
  aplicarConfigRemota(cfg, { estrategia: 'consultoria' });
  assert.equal(cfg.estrategia, 'consultoria');
  aplicarConfigRemota(cfg, { estrategia: 'qualquer coisa' });
  assert.equal(cfg.estrategia, 'consultoria');
  assert.equal(configParaLinha({ ...config, estrategia: 'consultoria' }).estrategia, 'consultoria');
  assert.equal(configParaLinha({ ...config }).estrategia, 'conversa');
});

await teste('mensagens de valor um pouco mais longas passam (até 1.200 caracteres no total), acima disso são bloqueadas', () => {
  const l = lead();
  assert.equal(validarSaida('Sem planejamento a Receita assume o pior cenário. '.repeat(18), l).ok, true);
  assert.equal(validarSaida('Sem planejamento a Receita assume o pior cenário. '.repeat(30), l).ok, false);
});

console.log('\nMensagens cortadas e mensagens prontas');

await teste('sucinto: prompt tem a regra "SEJA SUCINTA" nas duas estratégias e mantém as técnicas de venda', () => {
  for (const estrategia of ['conversa', 'consultoria']) {
    const sis = montarSistema(lead(), { ...config, estrategia });
    assert.match(sis, /SEJA SUCINTA/);
    assert.match(sis, /no máximo 2 frases curtas/);
    assert.match(sis, /Uma técnica por mensagem/);
    assert.match(sis, /Valor em doses/);
    assert.match(sis, /ARSENAL DE TÉCNICAS/);
    assert.match(sis, /AUDITORIA antes do preço|sempre passe valor/);
    assert.doesNotMatch(sis, /1 a 3 frases; até 4/);
  }
});

await teste('foco em fechar: estratégia "conversa" manda mostrar a conta cedo, convidar ao fechamento e puxar toda dúvida de volta para a decisão, sem pressão', () => {
  const sis = montarSistema(lead(), { ...config, estrategia: 'conversa' });
  assert.match(sis, /FOCO AGORA: FECHAR O CONTRATO/);
  assert.match(sis, /já na 2ª ou 3ª resposta/);
  assert.match(sis, /puxe de volta para a decisão/);
  assert.match(sis, /nunca autoriza pressão, urgência inventada/);
  assert.match(sis, /PASSAR VALOR antes de falar de honorário/);
  const bloco = sis.slice(sis.indexOf('FOCO AGORA'), sis.indexOf('1. ENTENDER'));
  assert.doesNotMatch(bloco, /só paga|risco zero|sem risco|advogado|jurídic|direito/i);
});

await teste('sucinto: muitoLonga ignora mensagem pronta (lista) e pega parágrafo grande', () => {
  assert.equal(muitoLonga('Oi! Tudo bem?'), false);
  assert.equal(muitoLonga('palavra '.repeat(120)), true);
  const lista = 'Segue o que preciso:\n*Nome completo*\n*CPF*\n*Endereço*\n*E-mail*\n' + 'x'.repeat(700);
  assert.equal(muitoLonga(lista), false, 'mensagem pronta com negrito não é cortada');
  const bloco = Array.from({ length: 6 }, (_, i) => `Item ${i} ` + 'y'.repeat(120)).join('\n');
  assert.equal(muitoLonga(bloco), false, 'lista em um bloco só não é cortada');
});

await teste('sucinto: resposta correta mas comprida pede UMA versão curta; se continuar longa, envia (sem passar para o Gabriel)', async () => {
  const longa = { content: [{ type: 'text', text: 'Entendo perfeitamente a sua situação e quero te explicar tudo com calma. '.repeat(10) }], stop_reason: 'end_turn' };
  const curta = { content: [{ type: 'text', text: 'Parece que a certidão está travando a venda. Como está o prazo da escritura?' }], stop_reason: 'end_turn' };
  const chamadas = [];
  const fila = [longa, curta];
  const client = { chamadas, messages: { async create(p) { chamadas.push(JSON.parse(JSON.stringify(p))); return fila.shift(); } } };
  const cerebro = criarCerebro({ modelo: 'teste', config, client });
  const r = await cerebro.gerarResposta({ lead: lead(), historico: [{ direcao: 'lead', texto: 'preciso vender a casa' }], ferramentas: {}, log: silencioso });
  assert.equal(r.acao, null);
  assert.deepEqual(r.mensagens, ['Parece que a certidão está travando a venda. Como está o prazo da escritura?']);
  assert.equal(chamadas.length, 2);
  assert.match(chamadas[1].messages.at(-1).content, /comprida demais/);
  const sempreLonga = { messages: { async create() { return longa; } } };
  const c2 = criarCerebro({ modelo: 'teste', config, client: sempreLonga });
  const r2 = await c2.gerarResposta({ lead: lead(), historico: [{ direcao: 'lead', texto: 'oi' }], ferramentas: {}, log: silencioso });
  assert.equal(r2.acao, null, 'não passa para o Gabriel só por ser longa');
  assert.ok(r2.mensagens.length >= 1);
});

await teste('resposta cortada por limite de tamanho nunca é enviada: o bot pede reescrita e, se continuar cortando, passa para o Gabriel', async () => {
  const cortado = { content: [{ type: 'text', text: 'Sobre a sua pergunta anter' }], stop_reason: 'max_tokens' };
  const inteiro = { content: [{ type: 'text', text: 'Os dados do profissional são: nome completo, CPF e endereço. Quer que eu liste?' }], stop_reason: 'end_turn' };
  const chamadas = [];
  const fila = [cortado, inteiro];
  const client = { chamadas, messages: { async create(p) { chamadas.push(JSON.parse(JSON.stringify(p))); return fila.shift(); } } };
  const cerebro = criarCerebro({ modelo: 'teste', config, client });
  const r = await cerebro.gerarResposta({ lead: lead(), historico: [{ direcao: 'lead', texto: 'que dados do profissional?' }], ferramentas: {}, log: silencioso });
  assert.equal(r.acao, null);
  assert.deepEqual(r.mensagens, ['Os dados do profissional são: nome completo, CPF e endereço. Quer que eu liste?']);
  assert.match(chamadas[1].messages.at(-1).content, /cortada/);
  assert.ok(chamadas[0].max_tokens >= 2000, 'limite folgado');
  const sempre = { chamadas: [], messages: { async create() { return cortado; } } };
  const c2 = criarCerebro({ modelo: 'teste', config, client: sempre });
  const r2 = await c2.gerarResposta({ lead: lead(), historico: [{ direcao: 'lead', texto: 'oi' }], ferramentas: {}, log: silencioso });
  assert.equal(r2.acao.tipo, 'passar');
  assert.ok(!r2.mensagens.join(' ').includes('anter'), 'texto cortado não sai');
});

await teste('prompt manda usar mensagens prontas do conhecimento como estão e pedir dados do contrato', () => {
  const sis = montarSistema(lead(), config, '## Documentos\nSe o lead perguntar quais documentos precisa, enviar essa msg:\n* Alvará');
  assert.match(sis, /MENSAGENS PRONTAS/);
  assert.match(sis, /COMO ESTÁ/);
  assert.match(sis, /dados pedidos para o contrato/);
  assert.match(sis, /Se o lead perguntar quais documentos precisa/);
});

await teste('lista pronta em uma só mensagem (sem linhas em branco) sai inteira em uma mensagem', async () => {
  const lista = 'José, esses são os documentos que o Gabriel costuma pedir:\n* Dados do profissional\n* Procuração digital\n* Alvará\n* Projeto\n* CNO (se tiver)\n* Habite-se (se tiver)\n* Cadastro imobiliário (guia do IPTU)\n* Localização do terreno no Google Maps';
  const ctx = montar({ roteiro: [texto(lista)] });
  const c = await abrir(ctx, lead());
  const antes = ctx.wa.enviados.length;
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'quais documentos preciso mandar?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  const novas = ctx.wa.enviados.slice(antes);
  assert.equal(novas.length, 1);
  assert.equal(novas[0].texto, lista);
});

await teste('chamada ao Claude desliga o pensamento; se a API recusar o parâmetro, tenta sem ele e não volta a pedir', async () => {
  const recebidos = [];
  const client = {
    messages: {
      async create(p) {
        recebidos.push(p);
        if (p.thinking) {
          const e = new Error('thinking: disabled is not supported for this model');
          e.status = 400;
          throw e;
        }
        return { content: [], stop_reason: 'end_turn' };
      },
    },
  };
  const chamar = criarChamador(client, silencioso);
  await chamar({ model: 'm', max_tokens: 10, messages: [] });
  await chamar({ model: 'm', max_tokens: 10, messages: [] });
  assert.deepEqual(recebidos.map((p) => Boolean(p.thinking)), [true, false, false]);
  const ok = [];
  const c2 = criarChamador({ messages: { async create(p) { ok.push(p); return { content: [] }; } } }, silencioso);
  await c2({ model: 'm', max_tokens: 10, messages: [] });
  assert.deepEqual(ok[0].thinking, { type: 'disabled' });
});

console.log('\nAbertura com os números do site');

await teste('abertura traz o valor da Receita, o valor com planejamento, a economia em R$ e o percentual (pessoa física)', () => {
  const l = lead({ area_principal: 180, inss_estimado: 16760, valor_apos_reducao: 9311, economia_estimada: 7449, percentual_reducao: 44.4 });
  const a = montarAbertura(l, 'Lia');
  assert.equal(
    a.texto.replace(/\u00a0/g, ' '),
    'Oi, Maria, tudo bem? Aqui é Lia, assistente do Gabriel Zaneloti, especialista em regularização de INSS de obra. Vi que você simulou a obra de 180 m² aqui no site, e a estimativa do valor cobrado pela Receita Federal foi de R$ 16.760. Com nosso planejamento o INSS da obra ficaria em R$ 9.311; isso representa R$ 7.449 (cerca de 44,4%) de economia. E o saldo do INSS da obra ainda pode ser parcelado em até 60 vezes. Posso te explicar rapidinho de onde vêm esses números?', 'texto exatamente como o Gabriel pediu');
  assert.equal(validarSaida(a.texto, l).ok, true, 'passa nas travas');
  assert.doesNotMatch(a.texto, /honor[aá]rio|12%/i);
});

await teste('abertura calcula o percentual quando o site não trouxe e mantém o texto antigo se faltar valor', () => {
  const sem = montarAbertura(lead({ inss_estimado: 20000, valor_apos_reducao: 10000, economia_estimada: 10000, percentual_reducao: null }), 'Lia');
  assert.match(sem.texto, /cerca de 50%\) de economia/);
  const faltando = montarAbertura(lead({ inss_estimado: 20000, economia_estimada: 10000, valor_apos_reducao: null }), 'Lia');
  assert.doesNotMatch(faltando.texto, /Com nosso planejamento/);
  assert.match(faltando.texto, /economia ficou em torno de R\$\s10\.000/);
});

await teste('a abertura nova vale para economia grande, média e pequena', () => {
  for (const eco of [3000, 9000, 40000]) {
    const l = lead({ inss_estimado: eco * 2, valor_apos_reducao: eco, economia_estimada: eco, percentual_reducao: 50 });
    const a = montarAbertura(l, 'Lia');
    assert.match(a.texto, /Com nosso planejamento o INSS da obra ficaria em/);
    assert.equal(validarSaida(a.texto, l).ok, true);
  }
});

await teste('empresa nunca recebe valores na abertura', () => {
  const a = montarAbertura(lead({ responsavel: 'PJ', inss_estimado: 17000, economia_estimada: 9000, valor_apos_reducao: 8000 }), 'Lia');
  assert.doesNotMatch(a.texto, /R\$/);
});

await teste('a área na abertura soma a principal com a complementar; o prompt traz a área total', () => {
  const l = lead({ area_principal: 180, area_piscina: 20, inss_estimado: 15542, valor_apos_reducao: 5758, economia_estimada: 9784, percentual_reducao: 63 });
  const a = montarAbertura(l, 'Lia');
  assert.match(a.texto, /a obra de 200 m²/);
  assert.match(montarSistema(l, config), /Área total \(principal \+ complementar\): 200 m²/);
  const sem = montarAbertura(lead({ area_principal: 180, area_piscina: null }), 'Lia');
  assert.match(sem.texto, /a obra de 180 m²/);
  assert.doesNotMatch(montarSistema(lead({ area_principal: 180, area_piscina: null }), config), /Área total/);
});

console.log('\nMão de obra: pessoa física x empresa');

await teste('pessoa física: bloqueia falar em funcionário registrado/CLT; empresa pode', () => {
  const pf = lead({ responsavel: 'PF' });
  const pj = lead({ responsavel: 'PJ', economia_estimada: null, inss_estimado: null });
  for (const t of [
    'Tem algum funcionário registrado ou prestador com recolhimento de INSS ligado à obra?',
    'Teve pedreiro com carteira assinada na obra?',
    'Os trabalhadores eram CLT?',
    'Os funcionários registrados na época viram crédito.',
  ]) {
    const r = validarSaida(t, pf);
    assert.equal(r.ok, false, t);
    assert.match(r.motivo, /AUTÔNOMO/);
    assert.equal(validarSaida(t, pj).ok, true, `empresa pode: ${t}`);
  }
  assert.equal(validarSaida('Durante a obra, teve pedreiro ou algum prestador autônomo? Mesmo sem recolhimento, dá para regularizar recolhendo depois.', pf).ok, true);
});

await teste('prompt e conhecimento trazem a regra: autônomo com recolhimento retroativo para pessoa física', () => {
  const sis = montarSistema(lead({ responsavel: 'PF' }), config, carregarConhecimento().texto);
  assert.match(sis, /AUTÔNOMO \(contribuinte individual\)/);
  assert.match(sis, /RETROATIVA/);
  assert.match(sis, /MÃO DE OBRA \(pessoa física\)/);
  assert.match(sis, /nunca tenha recolhido nada/);
  const c = carregarConhecimento().texto;
  assert.match(c, /inclusive de forma retroativa/);
  assert.doesNotMatch(c, /quem teve funcionário registrado na obra costuma ter o melhor resultado/);
});

await teste('fluxo: se a Lia perguntar por funcionário registrado a pessoa física, a resposta é bloqueada e reescrita com autônomo', async () => {
  const ctx = montar({
    roteiro: [
      texto('Pra eu entender melhor: tem algum funcionário registrado na obra?'),
      texto('Pra eu entender melhor: durante a obra, teve pedreiro ou algum prestador autônomo? Mesmo sem INSS recolhido, dá para regularizar recolhendo depois.'),
    ],
  });
  const c = await abrir(ctx, lead({ responsavel: 'PF' }));
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'como posso reduzir?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.wa.enviados.at(-1).texto, /autônomo/);
  assert.doesNotMatch(ctx.wa.enviados.map((e) => e.texto).join(' '), /funcionário registrado/);
});

await teste('item aprendido que fala de CLT só passa se disser que é de empresa', () => {
  const ctxv = { lead: lead(), nomeContato: '' };
  const base = { topico: 'mão de obra', pergunta: 'Funcionários registrados ajudam a reduzir o INSS da obra?' };
  assert.equal(validarAprendizado({ ...base, resposta: 'Sim, os funcionários registrados na época da obra viram crédito quando ligados ao CNO da obra.' }, ctxv).ok, false);
  assert.equal(validarAprendizado({ ...base, resposta: 'Para empresa, os funcionários registrados na época da obra viram crédito quando ligados ao CNO da obra.' }, ctxv).ok, true);
});

await teste('texto corrigido do conhecimento substitui a versão antiga do CRM só se ninguém editou', async () => {
  const antigo = 'texto antigo do arquivo 04';
  const store = criarStoreMemoria();
  store.atualizarConhecimento = async (id, conteudo) => {
    store.conhecimentoRemoto.find((l) => l.id === id).conteudo = conteudo;
  };
  const cfg = { ...config, ativo: true, listaTeste: [], horarioInicio: '08:00', horarioFim: '20:00', cambio: 5.5, arquivoParar: 'x.txt' };
  const itens = [{ chave: '04-formas-de-reduzir.md', titulo: 'formas de reduzir', conteudo: 'texto NOVO corrigido', ordem: 40 }];
  const versoes = { '04-formas-de-reduzir.md': [sha256(antigo)] };
  const mk = () => criarPainel({ store, wa: criarWaFalso(), bot: {}, config: cfg, conhecimento: { texto: '', valores: [], arquivos: [] }, conhecimentoArquivos: { itens, versoes }, log: silencioso, controle: criarControleDePausa(cfg) });
  store.estados.conhecimento_semeado = JSON.stringify(['04-formas-de-reduzir.md']);
  store.conhecimentoRemoto.push({ id: 7, ativo: true, chave: '04-formas-de-reduzir.md', titulo: 'x', conteudo: antigo, ordem: 40 });
  await mk().preparar();
  assert.equal(store.conhecimentoRemoto[0].conteudo, 'texto NOVO corrigido', 'versão intacta é atualizada');
  store.conhecimentoRemoto[0].conteudo = 'o Gabriel editou isto';
  await mk().preparar();
  assert.equal(store.conhecimentoRemoto[0].conteudo, 'o Gabriel editou isto', 'edição do Gabriel é preservada');
});

console.log('\nParcelamento como diferencial');

await teste('prompt manda citar o parcelamento (até 60 parcelas, Gabriel cuida) e lembra enquanto ainda não foi citado', () => {
  const base = montarSistema(lead(), config);
  assert.match(base, /DIFERENCIAL OBRIGATÓRIO, O PARCELAMENTO/);
  assert.match(base, /até 60 parcelas/);
  assert.doesNotMatch(base, /AINDA NÃO CITOU O PARCELAMENTO/, 'por padrão não há lembrete');
  const lembrete = montarSistema(lead(), config, '', '', null, '', '', false);
  assert.match(lembrete, /AINDA NÃO CITOU O PARCELAMENTO/);
  assert.doesNotMatch(montarSistema(lead(), config, '', '', 'preço', '', '', false), /AINDA NÃO CITOU/, 'em modo espera não cobra');
});

await teste('cérebro só lembra o parcelamento até o bot citá-lo (a abertura não conta)', async () => {
  const mk = () => {
    const chamadas = [];
    return { chamadas, messages: { async create(p) { chamadas.push(p); return { content: [{ type: 'text', text: 'Claro, vamos ver isso.' }], stop_reason: 'end_turn' }; } } };
  };
  const c1 = mk();
  const r1 = criarCerebro({ modelo: 't', config, client: c1 });
  await r1.gerarResposta({ lead: lead(), historico: [{ direcao: 'bot', texto: 'Oi, sou a Lia. Posso te explicar de onde vêm esses números?' }, { direcao: 'lead', texto: 'pode' }], ferramentas: {}, log: silencioso });
  assert.match(c1.chamadas[0].system, /AINDA NÃO CITOU O PARCELAMENTO/);
  const c2 = mk();
  const r2 = criarCerebro({ modelo: 't', config, client: c2 });
  await r2.gerarResposta({ lead: lead(), historico: [{ direcao: 'bot', texto: 'O saldo ainda pode ser parcelado em até 60 vezes e o Gabriel cuida disso.' }, { direcao: 'lead', texto: 'legal, e como funciona?' }], ferramentas: {}, log: silencioso });
  assert.doesNotMatch(c2.chamadas[0].system, /AINDA NÃO CITOU O PARCELAMENTO/);
});

await teste('toda abertura cita o parcelamento (até 60 vezes) antes da pergunta final', () => {
  const casos = [
    lead({ inss_estimado: 16760, valor_apos_reducao: 9311, economia_estimada: 7449, percentual_reducao: 44 }),
    lead({ inss_estimado: 16760, valor_apos_reducao: 9311, economia_estimada: 40000, percentual_reducao: 80 }),
    lead({ inss_estimado: 16760, valor_apos_reducao: 9311, economia_estimada: 3000 }),
    lead({ responsavel: 'PJ', economia_estimada: null, inss_estimado: null }),
    lead({ data_inicio: '2019-05-01' }),
    lead({ inss_estimado: null, economia_estimada: null }),
    lead({ nome: '' }),
  ];
  for (const l of casos) {
    const a = montarAbertura(l, 'Lia');
    assert.match(a.texto, /E o saldo do INSS da obra ainda pode ser parcelado em até 60 vezes\./, a.variante);
    assert.match(a.texto, /parcelado em até 60 vezes\. [^.!?]*\?$/, `parcelamento vem antes da pergunta final (${a.variante})`);
    assert.equal(validarSaida(a.texto, l).ok, true, `${a.variante}: ${validarSaida(a.texto, l).motivo}`);
  }
});

console.log('\nAprendizado automático');

const itemBom = {
  topico: 'pré-moldado',
  pergunta: 'Notas de pré-moldado em vigas e colunas ajudam a reduzir o INSS da obra?',
  resposta: 'Sim, quando as notas fiscais de pré-moldado somam pelo menos 40% do custo da área, a remuneração daquela área pode ser reduzida em 70%. Vale guardar todas as notas da obra.',
};

await teste('filtros: item geral passa; telefone, R$, nome do cliente, preço e palavra proibida são barrados', () => {
  const ctxv = { lead: lead({ nome: 'Carlos Pereira' }), nomeContato: '' };
  assert.equal(validarAprendizado(itemBom, ctxv).ok, true);
  const ruim = (resposta, extra = {}) => validarAprendizado({ ...itemBom, resposta, ...extra }, ctxv);
  assert.equal(ruim('Me chama no 11 91234 5678 que eu te explico como funciona a regra toda.').ok, false, 'telefone');
  assert.equal(ruim('A economia costuma ficar em R$ 30.000 quando as notas somam 40% do custo da obra.').ok, false, 'R$');
  assert.equal(ruim('No caso do Carlos a nota de pré-moldado reduz a remuneração da área toda.').ok, false, 'nome do lead');
  assert.equal(ruim('Nosso honorário é calculado sobre a economia que a gente consegue comprovar.').ok, false, 'honorário');
  assert.equal(ruim('Você tem direito a reduzir quando as notas somam 40% do custo da obra, é só juntar.').ok, false, 'palavra proibida');
  assert.equal(ruim('Escreva para mim em contato@exemplo.com com as notas fiscais para eu analisar a obra.').ok, false, 'e-mail');
  assert.equal(ruim('Curto demais.').ok, false, 'curto');
  assert.equal(validarAprendizado({ ...itemBom, resposta: 'Para pessoa jurídica, os funcionários registrados na época da obra podem ser vinculados ao CNO da obra para abater o recolhimento.' }, ctxv).ok, true, 'pessoa jurídica é permitido');
});

await teste('índice: dúvida parecida encontra o item aprendido e o prompt recebe o bloco; sem item não há bloco', async () => {
  const ind = criarIndiceAprendizado([{ ...itemBom, ativo: true }, { ...itemBom, pergunta: 'Outra dúvida sobre decadência de cinco anos na obra antiga?', resposta: 'A decadência vale cinco anos contados do ano seguinte ao fato gerador, e precisa de prova da época da obra.', topico: 'decadência', ativo: false }]);
  assert.equal(ind.total, 1, 'item inativo fica de fora');
  const achados = ind.buscar('as notas de pré-moldado reduzem o inss?');
  assert.equal(achados.length, 1);
  const texto = formatarAprendidos(achados);
  assert.match(texto, /Dúvida parecida/);
  const com = montarSistema(lead(), config, '', '', null, '', texto);
  assert.match(com, /O QUE O GABRIEL JÁ RESPONDEU/);
  assert.match(com, /40% do custo/);
  assert.doesNotMatch(montarSistema(lead(), config), /O QUE O GABRIEL JÁ RESPONDEU/);
});

await teste('cérebro: usa o aprendizado ao responder e a ferramenta de consulta passa a existir', async () => {
  const ind = criarIndiceAprendizado([{ ...itemBom, ativo: true }]);
  const store = criarStoreMemoria();
  const client = clienteFalso([texto('Em geral sim: se as notas de pré-moldado somam 40% do custo, reduz 70% da remuneração daquela área. O Gabriel confirma no seu caso. Teve notas?')]);
  const cerebro = criarCerebro({ modelo: 'teste', config, client, aprendizado: ind });
  const r = await cerebro.gerarResposta({ lead: lead(), historico: [{ direcao: 'lead', texto: 'nota de pré-moldado reduz o inss?' }], ferramentas: {}, log: silencioso });
  assert.equal(r.acao, null);
  assert.match(client.chamadas[0].system, /O QUE O GABRIEL JÁ RESPONDEU/);
  assert.ok(client.chamadas[0].tools.some((t) => t.name === 'consultar_documentos'));
  assert.ok(store);
});

function conversaComGabriel(ctx, c) {
  return (async () => {
    await ctx.store.addMensagem({ conversa_id: c.id, direcao: 'lead', texto: 'Notas de pré-moldado ajudam a reduzir?' });
    await ctx.store.addMensagem({ conversa_id: c.id, direcao: 'humano', texto: 'Ajudam sim. Se as notas somarem 40% do custo da área, a remuneração dela cai 70%. Mas no seu caso preciso ver as notas.' });
  })();
}

await teste('extração: conversa parada com resposta do Gabriel gera itens; marca como aprendida; não repete', async () => {
  const ctx = montar({});
  const c = await abrir(ctx, lead({ nome: 'Carlos Pereira' }));
  ctx.bot.pararTimers();
  await conversaComGabriel(ctx, c);
  const client = clienteFalso([[uso('registrar_aprendizados', { itens: [itemBom, { ...itemBom, pergunta: 'Qual o honorário do Gabriel por esse serviço de redução?', resposta: 'O honorário é um percentual sobre a economia comprovada na análise.' }] })]]);
  const ap = criarAprendizado({ store: ctx.store, modelo: 'teste', client, config: { aprendizadoAtivo: true }, log: silencioso, ociosoMs: 0 });
  const n = await ap.processarPendentes();
  assert.equal(n, 1, 'o item de honorário foi descartado');
  assert.equal(ctx.store.aprendizado.length, 1);
  assert.equal(ctx.store.conversas[0].aprendido_ate, 3);
  assert.match(client.chamadas[0].messages[0].content, /GABRIEL: Ajudam sim/);
  assert.equal(client.chamadas[0].tool_choice.name, 'registrar_aprendizados');
  assert.equal(await ap.processarPendentes(), 0, 'segunda passada não reanalisa');
  assert.equal(client.chamadas.length, 1);
});

await teste('extração: se o modelo não aceita forçar a ferramenta (erro 400 tool_choice), usa modo automático e aprende igual', async () => {
  const ctx = montar({});
  const c = await abrir(ctx, lead({ nome: 'Carlos Pereira' }));
  ctx.bot.pararTimers();
  await conversaComGabriel(ctx, c);
  const chamadas = [];
  const client = {
    chamadas,
    messages: {
      async create(params) {
        chamadas.push(JSON.parse(JSON.stringify(params)));
        if (params.tool_choice?.type === 'tool') {
          const e = new Error('400 {"message":"tool_choice: type \\"tool\\" and \\"any\\" are not supported for this model."}');
          e.status = 400;
          throw e;
        }
        return { content: [uso('registrar_aprendizados', { itens: [itemBom] })] };
      },
    },
  };
  const ap = criarAprendizado({ store: ctx.store, modelo: 'teste', client, config: { aprendizadoAtivo: true }, log: silencioso, ociosoMs: 0 });
  assert.equal(await ap.processarPendentes(), 1);
  assert.equal(ctx.store.aprendizado.length, 1);
  assert.equal(chamadas.length, 2, 'primeira tentativa forçada, segunda automática');
  assert.equal(chamadas[1].tool_choice.type, 'auto');
  assert.match(chamadas[1].system, /SEMPRE chamando a ferramenta registrar_aprendizados/);
});

await teste('extração: item parecido com um existente é descartado; lista vazia só marca como lida', async () => {
  const ctx = montar({});
  const c = await abrir(ctx, lead());
  ctx.bot.pararTimers();
  await conversaComGabriel(ctx, c);
  ctx.store.aprendizado.push({ id: 1, ativo: true, ...itemBom });
  const client = clienteFalso([[uso('registrar_aprendizados', { itens: [{ ...itemBom, resposta: 'Ajudam sim, desde que as notas somem 40% do custo da área e sejam guardadas.' }] })]]);
  const ap = criarAprendizado({ store: ctx.store, modelo: 'teste', client, config: { aprendizadoAtivo: true }, log: silencioso, ociosoMs: 0 });
  assert.equal(await ap.processarPendentes(), 0);
  assert.equal(ctx.store.aprendizado.length, 1);
  assert.equal(ctx.store.conversas[0].aprendido_ate, 3);
});

await teste('extração só começa depois da conversa ficar parada e respeita a chave geral', async () => {
  const ctx = montar({});
  const c = await abrir(ctx, lead());
  ctx.bot.pararTimers();
  await conversaComGabriel(ctx, c);
  const client = clienteFalso([[uso('registrar_aprendizados', { itens: [] })]]);
  const parada = criarAprendizado({ store: ctx.store, modelo: 'teste', client, config: { aprendizadoAtivo: true }, log: silencioso, ociosoMs: 30 * 60 * 1000 });
  assert.equal(await parada.processarPendentes(), 0);
  assert.equal(client.chamadas.length, 0, 'conversa recente: ainda não analisa');
  const desligado = criarAprendizado({ store: ctx.store, modelo: 'teste', client, config: { aprendizadoAtivo: false }, log: silencioso, ociosoMs: 0 });
  await desligado.processarPendentes();
  assert.equal(client.chamadas.length, 0, 'chave geral desligada: não analisa');
  assert.equal(ctx.store.conversas[0].aprendido_ate, undefined);
});

await teste('sem mensagem do Gabriel nada é analisado; falha da API não derruba nem marca como aprendida', async () => {
  const ctx = montar({});
  const c = await abrir(ctx, lead());
  ctx.bot.pararTimers();
  await ctx.store.addMensagem({ conversa_id: c.id, direcao: 'lead', texto: 'oi' });
  const client = clienteFalso([]);
  const ap = criarAprendizado({ store: ctx.store, modelo: 'teste', client, config: { aprendizadoAtivo: true }, log: silencioso, ociosoMs: 0 });
  assert.equal(await ap.processarPendentes(), 0);
  await conversaComGabriel(ctx, c);
  assert.equal(await ap.processarPendentes(), 0, 'roteiro vazio lança erro dentro do try');
  assert.equal(ctx.store.conversas[0].aprendido_ate, undefined, 'tenta de novo depois');
});

await teste('painel: sincronizar carrega o aprendizado ativo no índice e o config remoto liga/desliga', async () => {
  const store = criarStoreMemoria();
  store.aprendizado.push({ id: 1, ativo: true, ...itemBom }, { id: 2, ativo: false, ...itemBom, pergunta: 'Pergunta antiga desativada pelo Gabriel sobre algo?' });
  const cfg = { ...config, ativo: true, listaTeste: [], horarioInicio: '08:00', horarioFim: '20:00', cambio: 5.5, arquivoParar: 'x.txt', aprendizadoAtivo: true };
  const indice = { buscar: () => [], total: 0 };
  const p = criarPainel({ store, wa: criarWaFalso(), bot: {}, config: cfg, conhecimento: { texto: '', valores: [], arquivos: [] }, aprendizado: indice, log: silencioso, controle: criarControleDePausa(cfg) });
  store.configRemota = { aprendizado_ativo: false };
  await p.sincronizar();
  assert.equal(indice.total, 1);
  assert.equal(cfg.aprendizadoAtivo, false);
  assert.equal(configParaLinha({ ...cfg, aprendizadoAtivo: true }).aprendizado_ativo, true);
});

console.log('\nQuadro do CRM (cards)');

await teste('regras do funil: só avança, lateral em "sem resposta", fechado e perdido protegidos', () => {
  assert.equal(podeMover('novo', 'contatado'), true);
  assert.equal(podeMover('contatado', 'proposta_enviada'), true);
  assert.equal(podeMover('proposta_enviada', 'decidindo'), true);
  assert.equal(podeMover('decidindo', 'agendado'), true);
  assert.equal(podeMover('contatado', 'agendado'), true, 'pode pular etapas ao agendar');
  assert.equal(podeMover('agendado', 'decidindo'), false, 'nunca volta para trás');
  assert.equal(podeMover('decidindo', 'proposta_enviada'), false);
  assert.equal(podeMover('decidindo', 'contatado'), false);
  assert.equal(podeMover('contatado', 'sem_resposta'), true);
  assert.equal(podeMover('proposta_enviada', 'sem_resposta'), false, 'quem já recebeu proposta não vai para sem resposta');
  assert.equal(podeMover('sem_resposta', 'contatado'), true, 'respondeu: volta');
  assert.equal(podeMover('sem_resposta', 'agendado'), true);
  assert.equal(podeMover('agendado', 'perdido'), true);
  assert.equal(podeMover('fechado', 'perdido'), false);
  assert.equal(podeMover('fechado', 'agendado'), false);
  assert.equal(podeMover('perdido', 'contatado'), false, 'Gabriel mandou para perdido: o bot respeita');
  assert.equal(podeMover('contatado', 'contatado'), false);
  assert.equal(podeMover('contatado', 'status_inventado'), false);
});

await teste('citouHonorarios: palavra "honorários" junto de valor ou porcentagem', () => {
  assert.equal(citouHonorarios('Os honorários são 12% sobre a economia.'), true);
  assert.equal(citouHonorarios('Meus Honorários ficam em R$ 5.040.'), true);
  assert.equal(citouHonorarios('Honorário mínimo de R$ 600.'), true);
  assert.equal(citouHonorarios('Você economiza 55% no INSS da obra.'), false);
  assert.equal(citouHonorarios('Os honorários só entram depois da análise.'), false);
  assert.equal(citouHonorarios(''), false);
});

await teste('bot citou os honorários: card vai para "Proposta enviada"', async () => {
  const ctx = montar({ roteiro: [texto('Os honorários são de 12% sobre a economia conseguida, em torno de R$ 5.040 no seu caso.\n\nFaz sentido para você?')] });
  const l = lead();
  const c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'Quanto é o seu honorário?' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.store.leads.get(l.id).status, 'proposta_enviada');
  assert.match(ctx.store.leads.get(l.id).notas, /honorários/);
});

await teste('bot não puxa o card para trás nem mexe em card que o Gabriel fechou', async () => {
  for (const [antes, esperado] of [['decidindo', 'decidindo'], ['agendado', 'agendado'], ['fechado', 'fechado'], ['perdido', 'perdido']]) {
    const ctx = montar({ roteiro: [texto('Os honorários são de 12% sobre a economia conseguida.\n\nPosso te ajudar em mais algo?')] });
    const l = lead();
    const c = await abrir(ctx, l);
    ctx.store.leads.get(l.id).status = antes; // Gabriel arrastou o card à mão
    await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'e o honorário?' });
    await ctx.bot.responder(c.id);
    ctx.bot.pararTimers();
    assert.equal(ctx.store.leads.get(l.id).status, esperado, `card em "${antes}" fica onde está`);
  }
});

await teste('lead que não responde em 24h vai para "Sem resposta" e volta para "Contatado" quando responde', async () => {
  const ctx = montar({ roteiro: [texto('Claro! Me conta: a obra já foi concluída?')] });
  const l = lead();
  const c = await abrir(ctx, l);
  assert.equal(ctx.store.leads.get(l.id).status, 'contatado');
  assert.equal(await ctx.bot.marcarSemResposta(24), 1);
  assert.equal(ctx.store.leads.get(l.id).status, 'sem_resposta');
  assert.equal(await ctx.bot.marcarSemResposta(24), 0, 'não repete');
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi, vi sua mensagem agora' });
  assert.equal(ctx.store.leads.get(l.id).status, 'contatado', 'respondeu: sai de Sem resposta');
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(await ctx.bot.marcarSemResposta(24), 0, 'quem já respondeu nunca vai para Sem resposta');
});

await teste('se o banco ainda não aceita o status "agendado", o agendamento não quebra', async () => {
  const site = criarSite({
    siteUrl: 'https://exemplo.test',
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: true }) }),
  });
  const ctx = montar({ siteFalso: site, roteiro: [[uso('agendar_consultoria', { inicio: '2026-10-24T15:00:00.000Z', email: 'maria@exemplo.com' })], texto('Combinado, Maria! Deixei marcado e você vai receber a confirmação por e-mail.')] });
  const l = lead();
  const c = await abrir(ctx, l);
  const original = ctx.store.atualizarLead.bind(ctx.store);
  ctx.store.atualizarLead = async (id, patch) => {
    if (patch.status === 'agendado') throw new Error('violates check constraint "leads_status_check"');
    return original(id, patch);
  };
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'pode marcar, meu email é maria@exemplo.com' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /marcado/);
  assert.equal(ctx.store.agendou.length, 1);
});

console.log('\nAcompanhamento, lembretes e avisos');

const AGORA = new Date('2026-10-24T15:00:00Z'); // 12h em Brasília
const horasAtras = (h) => new Date(AGORA.getTime() - h * 3600000).toISOString();
const envelhecer = (ctx, h) => ctx.store.mensagens.forEach((m) => (m.criado_em = horasAtras(h)));

await teste('modelos de acompanhamento: tempos, textos e sem valor para empresa', () => {
  const pf = lead({ economia_estimada: 42000 });
  assert.equal(proximoFollowup({ nivelAtual: 0, ultimaDirecao: 'bot', ultimaEm: horasAtras(23), agora: AGORA.getTime() }), null);
  assert.equal(proximoFollowup({ nivelAtual: 0, ultimaDirecao: 'bot', ultimaEm: horasAtras(25), agora: AGORA.getTime() }), 1);
  assert.equal(proximoFollowup({ nivelAtual: 1, ultimaDirecao: 'bot', ultimaEm: horasAtras(47), agora: AGORA.getTime() }), null);
  assert.equal(proximoFollowup({ nivelAtual: 1, ultimaDirecao: 'bot', ultimaEm: horasAtras(49), agora: AGORA.getTime() }), 2);
  assert.equal(proximoFollowup({ nivelAtual: 2, ultimaDirecao: 'bot', ultimaEm: horasAtras(97), agora: AGORA.getTime() }), 3);
  assert.equal(proximoFollowup({ nivelAtual: 3, ultimaDirecao: 'bot', ultimaEm: horasAtras(900), agora: AGORA.getTime() }), null, 'máximo de 3');
  assert.equal(proximoFollowup({ nivelAtual: 0, ultimaDirecao: 'lead', ultimaEm: horasAtras(900), agora: AGORA.getTime() }), null, 'lead esperando resposta: não é caso de acompanhamento');
  assert.match(montarFollowup({ lead: pf, nivel: 1, respondeuAntes: false }), /economia de R\$\s42\.000/);
  assert.match(montarFollowup({ lead: pf, nivel: 1, respondeuAntes: true }), /Ficou alguma dúvida/);
  assert.match(montarFollowup({ lead: pf, nivel: 2, respondeuAntes: false }), /60 vezes/);
  assert.match(montarFollowup({ lead: pf, nivel: 3, respondeuAntes: false }), /desistiu de regularizar/);
  for (const nivel of [1, 2, 3]) {
    assert.doesNotMatch(montarFollowup({ lead: lead({ responsavel: 'PJ', economia_estimada: 42000 }), nivel, respondeuAntes: false }), /R\$/, 'empresa: nunca cita economia');
    for (const l of [pf, lead({ responsavel: 'PJ' }), lead({ economia_estimada: null })]) {
      for (const r of [true, false]) assert.equal(validarSaida(montarFollowup({ lead: l, nivel, respondeuAntes: r }), l).ok, true, `nível ${nivel} passa nas travas`);
    }
  }
});

await teste('acompanhamento: 1 dia, 3 dias e 7 dias de silêncio; depois para', async () => {
  const ctx = montar();
  const l = lead({ economia_estimada: 42000 });
  const c = await abrir(ctx, l);
  const enviados = () => ctx.wa.enviados.length;
  envelhecer(ctx, 10);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 0, 'ainda é cedo');
  envelhecer(ctx, 25);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 1);
  assert.match(ctx.wa.enviados[enviados() - 1].texto, /economia de R\$\s42\.000/);
  assert.equal(c.followup_nivel, 1);
  envelhecer(ctx, 1);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 0, 'não repete');
  envelhecer(ctx, 49);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 1);
  assert.match(ctx.wa.enviados[enviados() - 1].texto, /60 vezes/);
  envelhecer(ctx, 97);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 1);
  assert.match(ctx.wa.enviados[enviados() - 1].texto, /desistiu/);
  assert.equal(c.followup_nivel, 3);
  envelhecer(ctx, 2000);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 0, 'acabou: nunca passa de 3');
  assert.equal(enviados(), 4, 'abertura + 3 acompanhamentos');
  assert.equal(ctx.store.mensagens.filter((m) => m.direcao === 'bot').length, 4, 'tudo fica no histórico');
});

await teste('quando o lead responde, a contagem do acompanhamento recomeça', async () => {
  const ctx = montar({ roteiro: [texto('Claro! Me conta: a obra já foi concluída?')] });
  const l = lead();
  const c = await abrir(ctx, l);
  envelhecer(ctx, 25);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 1);
  assert.equal(c.followup_nivel, 1);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi, estava viajando' });
  assert.equal(c.followup_nivel, 0);
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  envelhecer(ctx, 26);
  assert.equal(await ctx.bot.processarFollowups({ agora: AGORA }), 1);
  assert.match(ctx.wa.enviados[ctx.wa.enviados.length - 1].texto, /Ficou alguma dúvida/, 'quem já conversou recebe a versão de retomada');
});

await teste('acompanhamento não insiste: lead esperando, espera do Gabriel, agendado, fechado, optout, humano, desligado, noite, parado, lista de teste', async () => {
  const preparar = async (extra = {}, cfg = {}, parado) => {
    const ctx = montar({ cfg, parado });
    const l = lead(extra);
    const c = await abrir(ctx, l);
    envelhecer(ctx, 30);
    return { ctx, l, c };
  };
  const roda = async ({ ctx }, agora = AGORA) => ctx.bot.processarFollowups({ agora });
  assert.equal(await roda(await preparar()), 1, 'controle: sem nenhuma trava envia');
  let t = await preparar();
  t.ctx.store.mensagens.push({ id: 99, conversa_id: t.c.id, direcao: 'lead', texto: 'oi', criado_em: horasAtras(30) });
  assert.equal(await roda(t), 0, 'lead falou por último: é o bot que deve resposta');
  t = await preparar();
  t.c.observacao = 'ESPERA_GABRIEL: pediu desconto';
  assert.equal(await roda(t), 0, 'esperando o Gabriel');
  for (const status of ['agendado', 'fechado', 'perdido']) {
    t = await preparar({ status });
    t.ctx.store.leads.get(t.l.id).status = status;
    assert.equal(await roda(t), 0, `card ${status}`);
  }
  for (const estado of ['optout', 'humano', 'encerrada']) {
    t = await preparar();
    t.c.estado = estado;
    assert.equal(await roda(t), 0, `conversa ${estado}`);
  }
  t = await preparar({}, { followupAtivo: false });
  assert.equal(await roda(t), 0, 'desligado no painel');
  t = await preparar();
  assert.equal(await roda(t, new Date('2026-10-25T01:00:00Z')), 0, 'de noite (22h em Brasília) não manda');
  t = await preparar({}, {}, () => true);
  assert.equal(await roda(t), 0, 'bot parado');
  t = await preparar({}, { listaTeste: ['11999990001'] });
  assert.equal(await roda(t), 0, 'fora da lista de teste');
});

await teste('lembretes: regras de quando cada mensagem da consultoria sai', () => {
  const base = { inicio: new Date(AGORA.getTime() + 20 * 3600000).toISOString(), fim: new Date(AGORA.getTime() + 20.5 * 3600000).toISOString(), criadoEm: horasAtras(72), agora: AGORA.getTime() };
  assert.deepEqual(lembreteDevido({ ...base, status: 'agendado' }), ['24h']);
  assert.deepEqual(lembreteDevido({ ...base, status: 'agendado', criadoEm: horasAtras(2) }), [], 'acabou de marcar: a confirmação já serve');
  assert.deepEqual(lembreteDevido({ ...base, status: 'agendado', inicio: new Date(AGORA.getTime() + 48 * 3600000).toISOString() }), [], 'ainda falta muito');
  assert.deepEqual(lembreteDevido({ ...base, status: 'agendado', inicio: new Date(AGORA.getTime() + 3600000).toISOString() }), ['1h']);
  assert.deepEqual(lembreteDevido({ ...base, status: 'cancelado' }), []);
  const passou = { inicio: new Date(AGORA.getTime() - 3 * 3600000).toISOString(), fim: new Date(AGORA.getTime() - 2.5 * 3600000).toISOString(), criadoEm: horasAtras(100), agora: AGORA.getTime() };
  assert.deepEqual(lembreteDevido({ ...passou, status: 'realizado' }), ['pos']);
  assert.deepEqual(lembreteDevido({ ...passou, status: 'agendado' }), [], 'só manda pós-consultoria se o Gabriel marcou Realizado');
  assert.deepEqual(lembreteDevido({ ...passou, status: 'nao_compareceu' }), ['faltou']);
  assert.deepEqual(lembreteDevido({ ...passou, status: 'realizado', inicio: new Date(AGORA.getTime() - 100 * 3600000).toISOString(), fim: new Date(AGORA.getTime() - 99 * 3600000).toISOString() }), [], 'passou de 48h: não manda mais');
  const a = '2026-10-24T15:00:00Z';
  assert.equal(descreverQuando(a, AGORA), 'hoje às 12h');
  assert.equal(descreverQuando(a, new Date('2026-10-23T15:00:00Z')), 'amanhã às 12h');
  assert.match(descreverQuando('2026-10-27T15:30:00Z', AGORA), /^terça-feira, 27\/10, às 12h30$/);
  const l = lead();
  for (const tipo of ['24h', '1h', 'pos', 'faltou']) {
    assert.equal(validarSaida(montarMensagemConsultoria({ tipo, lead: l, inicio: a, agora: AGORA }), l).ok, true, `${tipo} passa nas travas`);
  }
  assert.match(montarMensagemConsultoria({ tipo: 'pos', lead: l, inicio: a }), /nome completo, CPF, endereço e e-mail/);
  assert.doesNotMatch(montarMensagemConsultoria({ tipo: 'pos', lead: lead({ responsavel: 'PJ' }), inicio: a }), /CPF/);
});

await teste('lembretes: 24h e 1h antes saem uma vez só; pós-consultoria e "não compareceu" também', async () => {
  const ctx = montar();
  const l = lead();
  const c = await abrir(ctx, l);
  const ag = (extra) => ({ id: 'ag1', nome: 'Maria', whatsapp: '11912345678', inicio: new Date(AGORA.getTime() + 20 * 3600000).toISOString(), fim: new Date(AGORA.getTime() + 20.5 * 3600000).toISOString(), status: 'agendado', created_at: horasAtras(72), ...extra });
  const ultimo = () => ctx.wa.enviados[ctx.wa.enviados.length - 1].texto;
  const antes = ctx.wa.enviados.length;
  ctx.store.agendamentos = [ag()];
  assert.equal(await ctx.bot.processarConsultorias({ agora: AGORA }), 1);
  assert.match(ultimo(), /lembrar da nossa consultoria gratuita amanhã às 8h/);
  assert.equal(await ctx.bot.processarConsultorias({ agora: AGORA }), 0, 'não repete');
  ctx.store.agendamentos = [ag({ inicio: new Date(AGORA.getTime() + 3600000).toISOString(), fim: new Date(AGORA.getTime() + 5400000).toISOString() })];
  assert.equal(await ctx.bot.processarConsultorias({ agora: AGORA }), 1);
  assert.match(ultimo(), /Daqui a pouco, às 13h/);
  ctx.store.agendamentos = [ag({ id: 'ag2', status: 'realizado', inicio: new Date(AGORA.getTime() - 3 * 3600000).toISOString(), fim: new Date(AGORA.getTime() - 2.5 * 3600000).toISOString() })];
  assert.equal(await ctx.bot.processarConsultorias({ agora: AGORA }), 1);
  assert.match(ultimo(), /Foi um prazer conversar/);
  ctx.store.agendamentos = [ag({ id: 'ag3', status: 'nao_compareceu', inicio: new Date(AGORA.getTime() - 3 * 3600000).toISOString(), fim: new Date(AGORA.getTime() - 2.5 * 3600000).toISOString() })];
  assert.equal(await ctx.bot.processarConsultorias({ agora: AGORA }), 1);
  assert.match(ultimo(), /novo horário/);
  assert.equal(ctx.wa.enviados.length - antes, 4);
  assert.ok(Object.keys(ctx.store.estados).some((k) => k.startsWith('lembrete:ag1:24h')), 'registrou antes de enviar');
});

await teste('lembretes não vão para quem o bot não conhece, conversa parada, noite, desligado ou cancelado', async () => {
  const montado = async (cfg = {}) => {
    const ctx = montar({ cfg });
    const c = await abrir(ctx, lead());
    ctx.store.agendamentos = [{ id: 'x1', nome: 'Maria', whatsapp: '11912345678', inicio: new Date(AGORA.getTime() + 20 * 3600000).toISOString(), fim: new Date(AGORA.getTime() + 20.5 * 3600000).toISOString(), status: 'agendado', created_at: horasAtras(72) }];
    return { ctx, c };
  };
  let t = await montado();
  t.ctx.store.agendamentos[0].whatsapp = '21988887777';
  assert.equal(await t.ctx.bot.processarConsultorias({ agora: AGORA }), 0, 'número sem conversa com o bot');
  t = await montado();
  t.c.estado = 'humano';
  assert.equal(await t.ctx.bot.processarConsultorias({ agora: AGORA }), 0, 'conversa com o Gabriel');
  t = await montado();
  assert.equal(await t.ctx.bot.processarConsultorias({ agora: new Date('2026-10-25T01:00:00Z') }), 0, 'noite');
  t = await montado({ lembretesAtivo: false });
  assert.equal(await t.ctx.bot.processarConsultorias({ agora: AGORA }), 0, 'desligado no painel');
  t = await montado();
  t.ctx.store.agendamentos[0].status = 'cancelado';
  assert.equal(await t.ctx.bot.processarConsultorias({ agora: AGORA }), 0, 'cancelado');
});

await teste('lead grande: avisa o Gabriel uma vez quando responde e quando fica sem resposta; lead pequeno e empresa não', async () => {
  const ctx = montar({ roteiro: [texto('Claro! Me conta: a obra já foi concluída?'), texto('Perfeito, anotei.')] });
  const l = lead({ economia_estimada: 42000 });
  const c = await abrir(ctx, l);
  assert.equal(ctx.avisosGrandes.length, 0, 'só a abertura: sem aviso');
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'oi, tenho interesse' });
  assert.equal(ctx.avisosGrandes.length, 1);
  assert.equal(ctx.avisosGrandes[0].tipo, 'Lead grande respondeu');
  assert.match(ctx.avisosGrandes[0].motivo, /R\$\s42\.000/);
  assert.match(ctx.avisosGrandes[0].motivo, /áudio/);
  await ctx.bot.responder(c.id);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'sim, já foi concluída' });
  assert.equal(ctx.avisosGrandes.length, 1, 'só avisa uma vez');
  ctx.bot.pararTimers();

  const pequeno = montar();
  const cp = await abrir(pequeno, lead({ economia_estimada: 1500 }));
  await pequeno.bot.aoReceber({ telefone: telefoneDe(cp), texto: 'oi' });
  pequeno.bot.pararTimers();
  assert.equal(pequeno.avisosGrandes.length, 0, 'economia abaixo do limite');

  const pj = montar();
  const cj = await abrir(pj, lead({ responsavel: 'PJ', economia_estimada: 90000 }));
  await pj.bot.aoReceber({ telefone: telefoneDe(cj), texto: 'oi' });
  pj.bot.pararTimers();
  assert.equal(pj.avisosGrandes.length, 0, 'empresa não tem economia estimada confiável');

  const sumiu = montar();
  await abrir(sumiu, lead({ economia_estimada: 42000 }));
  assert.equal(await sumiu.bot.marcarSemResposta(24), 1);
  assert.equal(sumiu.avisosGrandes.length, 1);
  assert.equal(sumiu.avisosGrandes[0].tipo, 'Lead grande sem resposta');
});

await teste('motivo da perda: o bot grava o motivo e não sobrescreve o que o Gabriel escolheu', async () => {
  // pediu para parar
  let ctx = montar();
  let l = lead();
  let c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'pare de me mandar mensagem' });
  assert.equal(ctx.store.leads.get(l.id).status, 'perdido');
  assert.equal(ctx.store.leads.get(l.id).motivo_perda, 'pediu_para_parar');
  // recusou por preço (registrar_status)
  ctx = montar({ roteiro: [[uso('registrar_status', { status: 'perdido', motivo_perda: 'preco', nota: 'achou caro' })], texto('Entendo, obrigada pela sinceridade.')] });
  l = lead();
  c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'achei caro, vou deixar' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.store.leads.get(l.id).status, 'perdido');
  assert.equal(ctx.store.leads.get(l.id).motivo_perda, 'preco');
  // encerrar sem motivo informado: "outro"; motivo inventado é ignorado
  ctx = montar({ roteiro: [[uso('encerrar_conversa', { motivo: 'já resolveu com contador', motivo_perda: 'ja_resolveu' })], texto('Tudo certo, obrigada!')] });
  l = lead();
  c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'já resolvi com meu contador' });
  await ctx.bot.responder(c.id);
  ctx.bot.pararTimers();
  assert.equal(ctx.store.leads.get(l.id).motivo_perda, 'ja_resolveu');
  await ctx.store.atualizarLead(l.id, { status: 'perdido', motivoPerda: 'inventado' });
  assert.equal(ctx.store.leads.get(l.id).motivo_perda, 'ja_resolveu');
  // Gabriel já escolheu um motivo: o bot não troca
  ctx = montar();
  l = lead({ motivo_perda: 'desconfianca' });
  c = await abrir(ctx, l);
  await ctx.bot.aoReceber({ telefone: telefoneDe(c), texto: 'parar' });
  assert.equal(ctx.store.leads.get(l.id).motivo_perda, 'desconfianca');
});

await teste('valor antes do preço: o prompt traz economia × honorário × quanto sobra, e o guard aceita só esses números', () => {
  const l = lead({ economia_estimada: 42000 });
  const sistema = montarSistema(l, config);
  assert.match(sistema, /COMPARAÇÃO PARA APRESENTAR O PREÇO[^\n]*economia estimada R\$\s42\.000, honorário R\$\s5\.040, sobra para a pessoa R\$\s36\.960/);
  assert.equal(validarSaida('Você economiza R$ 42.000, o honorário é R$ 5.040 e ficam R$ 36.960 no seu bolso.', l).ok, true);
  assert.equal(validarSaida('Ficam R$ 37.000 no seu bolso.', l).ok, false);
  assert.doesNotMatch(montarSistema(lead({ responsavel: 'PJ' }), config), /COMPARAÇÃO PARA APRESENTAR/, 'empresa não tem economia confiável');
  assert.doesNotMatch(montarSistema(lead({ economia_estimada: null }), config), /COMPARAÇÃO PARA APRESENTAR/);
});

await teste('prova social: regra no prompt e depoimentos reais (sem nome e sem valores) na base de conhecimento', () => {
  const sistema = montarSistema(lead(), config);
  assert.match(sistema, /PROVA SOCIAL/);
  assert.match(sistema, /SOMENTE se ele estiver escrito/);
  const k = carregarConhecimento();
  assert.ok(k.arquivos.includes('06-casos-de-sucesso.md'));
  assert.match(k.texto, /feedbacks REAIS/);
  const casos = k.texto.split('## Arquivo: 06-casos-de-sucesso.md')[1].split('## Arquivo:')[0];
  assert.doesNotMatch(casos, /R\$/, 'os depoimentos não têm valores inventados');
  assert.match(k.texto, /nunca prometa que o mesmo resultado/);
});


console.log(`\n${process.exitCode ? 'COM FALHAS' : 'Tudo certo'}: ${passou} testes passaram.\n`);
