/**
 * Ponte com o painel do CRM (aba "Bot").
 *
 *  - Configurações: o CRM grava na tabela `bot_config`; o bot lê a cada poucos segundos
 *    e aplica na hora (liga/desliga, nome da assistente, limites, horário, lista de teste).
 *  - Conhecimento: os textos que o bot usa ficam na tabela `bot_conhecimento` (editáveis no CRM).
 *    Na primeira vez, os arquivos da pasta `conhecimento/` são copiados para lá.
 *  - Status: a cada 15 s o bot grava um "sinal de vida" (heartbeat) que o CRM mostra como online/offline.
 *  - Comandos: o CRM manda "enviar mensagem", "assumir" e "devolver" pela tabela `bot_comandos`.
 */
import { existsSync } from 'node:fs';
import { extrairValoresReais } from './guards.js';

const FUSO = 'America/Sao_Paulo';
const EXPIRA_COMANDO_MS = 10 * 60 * 1000;

export const VERSAO_PAINEL = 'painel-1';
const ARQUIVOS_SEMEADOS_ANTES = ['01-parcelamento.md', '02-servicos-e-processo.md', '03-sobre-o-gabriel.md'];

const lista = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean);

const hhmm = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

const minutos = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

/** Valores que o painel pode mudar, no formato do banco (para criar a linha inicial a partir do .env). */
export function configParaLinha(config) {
  return {
    id: 1,
    ativo: config.ativo !== false,
    assistente_nome: config.assistenteNome,
    teto_mensagens_24h: config.tetoMensagens24h,
    economia_min_reuniao: config.economiaMinParaReuniao,
    lista_teste: (config.listaTeste || []).join(','),
    horario_ativo: Boolean(config.horarioAtivo),
    horario_inicio: config.horarioInicio,
    horario_fim: config.horarioFim,
    cambio_usd_brl: config.cambio,
  };
}

/** Copia a linha do banco para o objeto `config` (valida cada campo; valor inválido é ignorado). */
export function aplicarConfigRemota(config, linha) {
  if (!linha) return config;
  if (typeof linha.ativo === 'boolean') config.ativo = linha.ativo;
  const nome = String(linha.assistente_nome ?? '').trim();
  if (nome && nome.length <= 30) config.assistenteNome = nome;
  const teto = Number(linha.teto_mensagens_24h);
  if (Number.isInteger(teto) && teto >= 1 && teto <= 5000) config.tetoMensagens24h = teto;
  const eco = Number(linha.economia_min_reuniao);
  if (Number.isFinite(eco) && eco >= 0) config.economiaMinParaReuniao = eco;
  if (linha.lista_teste !== undefined && linha.lista_teste !== null) config.listaTeste = lista(linha.lista_teste);
  if (typeof linha.horario_ativo === 'boolean') config.horarioAtivo = linha.horario_ativo;
  const ini = hhmm(linha.horario_inicio);
  const fim = hhmm(linha.horario_fim);
  if (ini) config.horarioInicio = ini;
  if (fim) config.horarioFim = fim;
  const cambio = Number(linha.cambio_usd_brl);
  if (Number.isFinite(cambio) && cambio > 0) config.cambio = cambio;
  return config;
}

/** Hora atual de Brasília dentro da janela [início, fim)? Aceita janela que vira a noite (ex.: 22:00–06:00). */
export function dentroDoHorario(config, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  const atual = h * 60 + m;
  const ini = minutos(config.horarioInicio || '00:00');
  const fim = minutos(config.horarioFim || '23:59');
  if (ini === fim) return true;
  return ini < fim ? atual >= ini && atual < fim : atual >= ini || atual < fim;
}

/** Decide se o bot está pausado e por quê (uma única fonte de verdade para o bot e para o heartbeat). */
export function criarControleDePausa(config) {
  function motivo() {
    if (process.env.BOT_ATIVO === '0') return 'BOT_ATIVO=0 no .env';
    if (existsSync(config.arquivoParar)) return `arquivo ${config.arquivoParar} existe`;
    if (config.ativo === false) return 'desligado pelo painel';
    if (config.horarioAtivo && !dentroDoHorario(config)) return `fora do horário (${config.horarioInicio}–${config.horarioFim})`;
    return null;
  }
  return { motivo, parado: () => motivo() !== null };
}

/** Texto do conhecimento a partir das linhas da tabela. */
export function montarConhecimentoDeLinhas(linhas) {
  const ativas = (linhas || []).filter((l) => l.ativo !== false && String(l.conteudo || '').trim());
  const texto = ativas.map((l) => `## ${l.titulo}\n${String(l.conteudo).trim()}`).join('\n\n');
  return { texto, valores: extrairValoresReais(texto), arquivos: ativas.map((l) => l.titulo) };
}

export function criarPainel({ store, wa, bot, config, conhecimento, conhecimentoArquivos = { itens: [] }, log = console, controle, agora = () => Date.now() }) {
  const timers = [];
  let processando = false;
  let comandosOk = true;

  /** Cria a linha de configuração (a partir do .env) e semeia o conhecimento com os arquivos, só se ainda não existirem. */
  async function preparar() {
    try {
      const linha = await store.lerConfigRemota();
      if (!linha) await store.criarConfigRemota(configParaLinha(config));
      // Copia os arquivos da pasta conhecimento para o banco UMA vez (se o Gabriel apagar algo no CRM, não volta).
      // Arquivos novos na pasta são copiados quando aparecem pela primeira vez.
      if (conhecimentoArquivos.itens.length) {
        const raw = await store.lerEstado('conhecimento_semeado');
        let ja = [];
        if (raw) {
          try {
            const v = JSON.parse(raw);
            ja = Array.isArray(v) ? v : ARQUIVOS_SEMEADOS_ANTES;
          } catch {
            ja = ARQUIVOS_SEMEADOS_ANTES; // versão antiga guardava só a data
          }
        }
        const novos = conhecimentoArquivos.itens.filter((i) => !ja.includes(i.chave));
        if (novos.length) {
          await store.semearConhecimento(novos);
          await store.gravarEstado('conhecimento_semeado', JSON.stringify([...ja, ...novos.map((n) => n.chave)]));
        }
      }
    } catch (e) {
      log.warn(`[painel] não consegui preparar as tabelas do painel (${e.message}). Rodou o supabase_bot_painel.sql?`);
    }
    await sincronizar();
  }

  async function sincronizar() {
    try {
      const linha = await store.lerConfigRemota();
      if (linha) aplicarConfigRemota(config, linha);
      const linhas = await store.listarConhecimento();
      if (linhas) Object.assign(conhecimento, montarConhecimentoDeLinhas(linhas));
    } catch (e) {
      log.warn(`[painel] falha ao sincronizar configurações: ${e.message}`);
    }
  }

  async function heartbeat() {
    try {
      await store.gravarHeartbeat({
        ts: new Date(agora()).toISOString(),
        versao: VERSAO_PAINEL,
        whatsapp: Boolean(wa.conectado()),
        pausado: controle.parado(),
        motivo_pausa: controle.motivo(),
        lista_teste: (config.listaTeste || []).length,
        modo_teste: Boolean(config.modoTeste),
      });
    } catch (e) {
      log.warn(`[painel] falha ao gravar o sinal de vida: ${e.message}`);
    }
  }

  async function executar(cmd) {
    const conversa = await store.conversaPorId(cmd.conversa_id);
    if (!conversa) throw new Error('conversa não encontrada');

    if (cmd.tipo === 'assumir') {
      if (conversa.estado === 'ativa') await bot.assumir(conversa.id, 'Assumida pelo CRM');
      return;
    }
    if (cmd.tipo === 'devolver') {
      if (conversa.estado === 'optout') throw new Error('o lead pediu para não receber mensagens');
      if (conversa.estado === 'encerrada' && /telefone inválido|não está no WhatsApp/.test(conversa.observacao || '')) {
        throw new Error('essa conversa não tem WhatsApp válido');
      }
      await bot.devolver(conversa.id);
      return;
    }
    if (cmd.tipo === 'enviar') {
      const texto = String(cmd.texto || '').trim();
      if (!texto) throw new Error('mensagem vazia');
      if (texto.length > 3000) throw new Error('mensagem longa demais');
      if (conversa.estado === 'optout') throw new Error('o lead pediu para não receber mais mensagens');
      if (!conversa.jid) throw new Error('essa conversa não tem WhatsApp válido');
      if (!wa.conectado()) throw new Error('o WhatsApp do bot está desconectado agora');
      await bot.enviarComoGabriel(conversa, texto);
      return;
    }
    throw new Error(`comando desconhecido: ${cmd.tipo}`);
  }

  async function processarComandos() {
    if (processando) return;
    processando = true;
    try {
      const comandos = await store.comandosPendentes();
      comandosOk = true;
      for (const cmd of comandos) {
        try {
          if (agora() - Date.parse(cmd.criado_em) > EXPIRA_COMANDO_MS) {
            await store.marcarComando(cmd.id, { status: 'erro', erro: 'expirou (o bot estava desligado ou offline)' });
            continue;
          }
          await executar(cmd);
          await store.marcarComando(cmd.id, { status: 'feito' });
        } catch (e) {
          log.warn(`[painel] comando ${cmd.tipo} falhou: ${e.message}`);
          await store.marcarComando(cmd.id, { status: 'erro', erro: e.message });
        }
      }
    } catch (e) {
      if (comandosOk) log.warn(`[painel] falha ao ler comandos: ${e.message}`);
      comandosOk = false;
    } finally {
      processando = false;
    }
  }

  function iniciar({ configMs = 15000, heartbeatMs = 15000, comandosMs = 3000 } = {}) {
    timers.push(setInterval(sincronizar, configMs));
    timers.push(setInterval(heartbeat, heartbeatMs));
    timers.push(setInterval(processarComandos, comandosMs));
    heartbeat();
  }

  function parar() {
    for (const t of timers) clearInterval(t);
    timers.length = 0;
  }

  return { preparar, sincronizar, heartbeat, processarComandos, iniciar, parar };
}
