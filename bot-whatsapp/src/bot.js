/**
 * Lógica principal do bot (independente de WhatsApp/Supabase/Claude reais, para
 * poder ser testada com simulações — ver test/simulate.js).
 *
 * Fluxo:
 *   1. A cada poucos segundos procura leads NOVOS (criados depois que o bot foi ligado).
 *   2. Para cada um: confere o número, cria a conversa no banco (isso impede envio
 *      duplicado) e manda a abertura.
 *   3. Quando o lead responde, espera ele terminar de escrever, pede a resposta ao
 *      Claude e envia. O Claude pode agendar a consultoria, passar para o Gabriel ou encerrar.
 *   4. Se o Gabriel responder à mão numa conversa, o bot se cala nela.
 */
import { dividirMensagens, pediuParar, validarSaida } from './guards.js';
import { montarAbertura } from './opening.js';
import { aleatorio, dormir, normalizarTelefoneBR } from './util.js';

const VINTE_E_QUATRO_H = 24 * 60 * 60 * 1000;
const TRINTA_MIN = 30 * 60 * 1000;
const MARCA_ESPERA = 'ESPERA_GABRIEL: '; // guardada em observacao: a conversa segue 'ativa', mas já foi passada ao Gabriel

export function criarBot({ store, wa, cerebro, site, notificar, config, log = console, dormirFn = dormir, parado = () => false }) {
  const timers = new Map(); // conversaId -> timeout do "espera o lead terminar de escrever"
  const emAndamento = new Set(); // conversas sendo respondidas agora
  const vistos = new Set(); // leads já tratados nesta execução
  const falhasLead = new Map();
  const falhasResposta = new Map();
  const avisosEspera = new Map(); // conversaId -> quando avisamos que o lead está esperando
  let inicioDoBot = null;
  let avisouTeto = false;

  async function abaixoDoTeto() {
    const desde = new Date(Date.now() - VINTE_E_QUATRO_H).toISOString();
    const enviadas = await store.contarMensagensBot(desde);
    const ok = enviadas < config.tetoMensagens24h;
    if (ok) avisouTeto = false;
    return ok;
  }

  async function avisarTeto() {
    if (avisouTeto) return;
    avisouTeto = true;
    log.warn('[bot] teto de mensagens em 24h atingido; pausando envios.');
    await notificar.enviar(
      'Bot WhatsApp: teto de mensagens atingido',
      `<p>O bot chegou ao teto de ${config.tetoMensagens24h} mensagens em 24 horas e pausou os envios. Isso é uma trava de segurança. Se for normal para o seu volume, aumente TETO_MENSAGENS_24H no arquivo .env.</p>`
    );
  }

  async function enviar(conversa, texto) {
    const waId = await wa.enviarTexto(conversa.jid, texto);
    await store.addMensagem({ conversa_id: conversa.id, direcao: 'bot', texto, wa_id: waId });
  }

  // ---------------------------------------------------------------------------
  // 1) Leads novos
  // ---------------------------------------------------------------------------
  async function abrirConversa(lead) {
    const idadeMs = Date.now() - Date.parse(lead.created_at);
    if (idadeMs > config.maxIdadeLeadHoras * 3600 * 1000) return;
    if (await store.conversaPorLead(lead.id)) return;

    const telefone = normalizarTelefoneBR(lead.whatsapp);
    if (!telefone) {
      await store.criarConversa({ lead_id: lead.id, telefone: String(lead.whatsapp ?? ''), jid: null, estado: 'encerrada', observacao: 'telefone inválido' });
      await notificar.avisar({ tipo: 'Bot não conseguiu contatar', lead, telefone: null, motivo: 'O telefone informado não parece válido.' });
      return;
    }

    if (config.listaTeste.length && !config.listaTeste.some((n) => telefone.endsWith(n) || n.endsWith(telefone))) {
      return; // modo de teste: só fala com a lista
    }

    if (!(await abaixoDoTeto())) {
      await avisarTeto();
      vistos.delete(lead.id); // tenta de novo mais tarde
      return;
    }

    const jid = await wa.resolverJid(telefone);
    if (!jid) {
      await store.criarConversa({ lead_id: lead.id, telefone, jid: null, estado: 'encerrada', observacao: 'número não está no WhatsApp' });
      await store.atualizarLead(lead.id, { nota: 'Número informado não tem WhatsApp.' });
      await notificar.avisar({ tipo: 'Bot não conseguiu contatar', lead, telefone, motivo: 'Esse número não está no WhatsApp. Tente outro meio de contato.' });
      return;
    }

    const digitosJid = jid.split('@')[0].split(':')[0];
    const conversa = await store.criarConversa({ lead_id: lead.id, telefone: digitosJid, jid });
    if (!conversa) return; // já criada por outra execução

    const abertura = montarAbertura(lead, config.assistenteNome);
    const v = validarSaida(abertura.texto, lead);
    if (!v.ok) {
      await store.setEstado(conversa.id, 'encerrada', `abertura bloqueada: ${v.motivo}`);
      await notificar.avisar({ tipo: 'Bot não enviou a abertura', lead, telefone: digitosJid, motivo: `A mensagem inicial foi bloqueada (${v.motivo}). Chame o lead manualmente.` });
      return;
    }

    await dormirFn(aleatorio(config.aberturaMinMs, config.aberturaMaxMs));
    if (parado()) {
      await store.setEstado(conversa.id, 'encerrada', 'bot parado antes do envio');
      await notificar.avisar({ tipo: 'Bot parado: lead sem contato', lead, telefone: digitosJid, motivo: 'O bot foi parado antes de enviar a abertura. Chame o lead manualmente.' });
      return;
    }

    try {
      await enviar(conversa, abertura.texto);
    } catch (e) {
      await store.setEstado(conversa.id, 'encerrada', `falha ao enviar: ${e.message}`);
      await notificar.avisar({ tipo: 'Bot falhou ao enviar', lead, telefone: digitosJid, motivo: `Não consegui enviar a abertura (${e.message}). Chame o lead manualmente.` });
      return;
    }
    await store.atualizarLead(lead.id, { status: 'contatado', nota: `Abertura enviada pelo bot (${abertura.variante}).` });
    log.info(`[bot] abertura enviada para ${lead.nome || lead.id} (${abertura.variante})`);
  }

  async function processarNovosLeads() {
    if (parado() || !wa.conectado()) return;
    inicioDoBot ??= await store.inicioDoBot();
    const leads = await store.leadsNovos(inicioDoBot);
    for (const lead of leads) {
      if (vistos.has(lead.id)) continue;
      vistos.add(lead.id);
      try {
        await abrirConversa(lead);
      } catch (e) {
        const n = (falhasLead.get(lead.id) || 0) + 1;
        falhasLead.set(lead.id, n);
        log.error(`[bot] erro ao abrir conversa do lead ${lead.id} (tentativa ${n}):`, e.message);
        if (n < 3) vistos.delete(lead.id);
        else await notificar.avisar({ tipo: 'Bot com erro', lead, telefone: normalizarTelefoneBR(lead.whatsapp), motivo: `Não consegui abordar este lead (${e.message}). Chame manualmente.` });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2) Mensagens que chegam
  // ---------------------------------------------------------------------------
  async function aoReceber({ telefone, texto, tipo = 'texto', waId = null }) {
    const conversa = await store.conversaPorTelefone(telefone);
    if (!conversa) return; // nunca responde quem não foi abordado pelo bot

    const conteudo = texto && texto.trim() ? texto.trim() : `[o lead enviou ${tipo}]`;
    await store.addMensagem({ conversa_id: conversa.id, direcao: 'lead', texto: conteudo, wa_id: waId });
    if (conversa.estado === 'humano') {
      await avisarLeadEsperando(conversa, conteudo);
      return;
    }
    if (conversa.estado !== 'ativa') return;

    const lead = await store.leadPorId(conversa.lead_id);
    const historico = await store.historico(conversa.id);

    if (tipo === 'texto' && pediuParar(conteudo)) {
      cancelarTimer(conversa.id);
      await enviar(conversa, 'Tudo bem, não te envio mais mensagens. Obrigado pelo seu tempo!');
      await store.setEstado(conversa.id, 'optout', 'pediu para parar');
      await store.atualizarLead(conversa.lead_id, { status: 'perdido', nota: 'Pediu para não receber mais mensagens.' });
      return;
    }

    if (tipo !== 'texto' && !(texto && texto.trim())) {
      await enviar(conversa, 'Recebi o seu arquivo, mas por aqui eu consigo ler só texto. Consegue me escrever em poucas palavras?');
      await notificar.avisar({ tipo: 'Lead enviou mídia', lead, telefone: conversa.telefone, motivo: `O lead enviou ${tipo}, que o bot não lê. Vale olhar no seu WhatsApp.`, historico });
      return;
    }

    agendarResposta(conversa.id, config.debounceMs);
  }

  // Conversa passada para o Gabriel que ele ainda não respondeu: o lead escreveu de novo e está esperando.
  // Avisa por e-mail, no máximo uma vez a cada 30 minutos por conversa.
  async function avisarLeadEsperando(conversa, conteudo) {
    const hist = await store.historico(conversa.id);
    if (hist.some((m) => m.direcao === 'humano')) return; // o Gabriel já está conversando
    const ultimo = avisosEspera.get(conversa.id) || 0;
    if (Date.now() - ultimo < TRINTA_MIN) return;
    avisosEspera.set(conversa.id, Date.now());
    const lead = await store.leadPorId(conversa.lead_id);
    await notificar.avisar({
      tipo: 'Lead esperando resposta',
      lead,
      telefone: conversa.telefone,
      motivo: `O lead escreveu de novo depois que a conversa foi passada para você e o bot não responde mais. Última mensagem: "${String(conteudo).slice(0, 300)}"`,
      historico: hist,
    });
  }

  async function aoHumano({ telefone, texto, waId = null }) {
    const conversa = await store.conversaPorTelefone(telefone);
    if (!conversa) return;
    cancelarTimer(conversa.id);
    await store.addMensagem({ conversa_id: conversa.id, direcao: 'humano', texto: texto || '[mensagem sem texto]', wa_id: waId });
    if (conversa.estado === 'ativa') {
      await store.setEstado(conversa.id, 'humano', 'Gabriel respondeu pelo WhatsApp');
      log.info(`[bot] Gabriel assumiu a conversa ${conversa.id}; o bot se calou.`);
    }
  }

  function cancelarTimer(conversaId) {
    const t = timers.get(conversaId);
    if (t) clearTimeout(t);
    timers.delete(conversaId);
  }

  function agendarResposta(conversaId, ms) {
    cancelarTimer(conversaId);
    timers.set(
      conversaId,
      setTimeout(() => {
        timers.delete(conversaId);
        responder(conversaId).catch((e) => log.error('[bot] erro em responder:', e.message));
      }, ms)
    );
  }

  // ---------------------------------------------------------------------------
  // 3) Resposta do assistente
  // ---------------------------------------------------------------------------
  function montarFerramentas(conversa, lead) {
    return {
      ver_horarios: () => site.verHorarios(),
      agendar_consultoria: async ({ inicio, email }) => {
        const r = await site.agendar({
          nome: lead.nome,
          email,
          whatsapp: lead.whatsapp,
          inicio,
          observacoes: 'Agendado pela assistente de WhatsApp.',
        });
        if (r.ok) {
          await store.atualizarLead(lead.id, { status: 'decidindo', nota: `Consultoria agendada pelo bot para ${r.confirmado_para}.` });
          try {
            await store.marcarAgendou(conversa.id);
          } catch (e) {
            log.warn(`[bot] não consegui marcar o agendamento no painel: ${e.message}`);
          }
        }
        return r;
      },
      passar_para_gabriel: async () => ({ ok: true }),
      encerrar_conversa: async () => ({ ok: true }),
      registrar_status: async ({ status, nota }) => {
        await store.atualizarLead(lead.id, { status, nota });
        return { ok: true };
      },
    };
  }

  async function responder(conversaId) {
    if (emAndamento.has(conversaId)) {
      agendarResposta(conversaId, 5000);
      return;
    }
    emAndamento.add(conversaId);
    try {
      if (parado()) return;
      let conversa = await store.conversaPorId(conversaId);
      if (!conversa || conversa.estado !== 'ativa') return;
      if (!(await abaixoDoTeto())) {
        await avisarTeto();
        return;
      }

      const lead = await store.leadPorId(conversa.lead_id);
      const historico = await store.historico(conversa.id);
      const ultima = historico[historico.length - 1];
      if (!ultima || ultima.direcao !== 'lead') return; // nada novo para responder

      const emEspera = String(conversa.observacao || '').startsWith(MARCA_ESPERA);
      const motivoEspera = emEspera ? conversa.observacao.slice(MARCA_ESPERA.length) : '';

      let resultado;
      try {
        resultado = await cerebro.gerarResposta({ lead, historico, ferramentas: montarFerramentas(conversa, lead), log, espera: emEspera ? motivoEspera : null });
        falhasResposta.delete(conversaId);
        if (resultado.uso && (resultado.uso.entrada || resultado.uso.saida)) {
          try {
            await store.registrarUso({ conversa_id: conversaId, entrada: resultado.uso.entrada, saida: resultado.uso.saida });
          } catch (e) {
            log.warn(`[bot] não consegui registrar o consumo: ${e.message}`);
          }
        }
      } catch (e) {
        const n = (falhasResposta.get(conversaId) || 0) + 1;
        falhasResposta.set(conversaId, n);
        log.error(`[bot] falha ao gerar resposta (tentativa ${n}):`, e.message);
        if (n < 2) {
          agendarResposta(conversaId, 30000);
        } else {
          await store.setEstado(conversaId, 'humano', `falha técnica: ${e.message}`);
          await notificar.avisar({ tipo: 'Bot com falha técnica', lead, telefone: conversa.telefone, motivo: `Não consegui responder este lead (${e.message}). A conversa ficou com você.`, historico });
        }
        return;
      }

      // O Gabriel pode ter respondido enquanto o Claude pensava: se sim, descarta a resposta do bot.
      conversa = await store.conversaPorId(conversaId);
      if (!conversa || conversa.estado !== 'ativa') return;

      for (const [i, msg] of resultado.mensagens.entries()) {
        if (i > 0) await dormirFn(aleatorio(800, 1800));
        await enviar(conversa, msg);
      }

      const acao = resultado.acao;
      if (acao?.tipo === 'passar') {
        const hist = await store.historico(conversaId);
        const detalhe = `${acao.motivo}${acao.resumo ? ` — ${acao.resumo}` : ''}`;
        if (emEspera) {
          // Já tinha passado antes: o bot continua disponível; só avisa o Gabriel (no máximo 1x a cada 30 min).
          const ultimo = avisosEspera.get(conversaId) || 0;
          if (Date.now() - ultimo >= TRINTA_MIN) {
            avisosEspera.set(conversaId, Date.now());
            await notificar.avisar({ tipo: 'Lead com nova dúvida para você', lead, telefone: conversa.telefone, motivo: detalhe, historico: hist });
          }
        } else {
          // A conversa segue ativa (o bot ainda responde dúvidas simples); só para de vez quando o Gabriel responder.
          await store.setEstado(conversaId, 'ativa', `${MARCA_ESPERA}${acao.motivo}`);
          await store.atualizarLead(lead.id, { nota: `Passou para o Gabriel: ${acao.motivo}. ${acao.resumo || ''}`.trim() });
          avisosEspera.set(conversaId, Date.now());
          await notificar.avisar({ tipo: 'Passou para você', lead, telefone: conversa.telefone, motivo: detalhe, historico: hist });
        }
      } else if (acao?.tipo === 'encerrar') {
        await store.setEstado(conversaId, 'encerrada', acao.motivo);
        await store.atualizarLead(lead.id, { status: 'perdido', nota: `Conversa encerrada pelo bot: ${acao.motivo}` });
      }
    } finally {
      emAndamento.delete(conversaId);
    }
  }

  // ---------------------------------------------------------------------------
  // 4) Ações pedidas pelo painel do CRM
  // ---------------------------------------------------------------------------
  async function assumir(conversaId, observacao = 'Assumida pelo CRM') {
    cancelarTimer(conversaId);
    await store.setEstado(conversaId, 'humano', observacao);
  }

  async function devolver(conversaId) {
    await store.setEstado(conversaId, 'ativa', null);
    const historico = await store.historico(conversaId);
    const ultima = historico[historico.length - 1];
    // Se o lead ficou sem resposta, o bot retoma de onde parou.
    if (ultima && ultima.direcao === 'lead') agendarResposta(conversaId, 3000);
  }

  async function enviarComoGabriel(conversa, texto) {
    const waId = await wa.enviarTexto(conversa.jid, texto);
    await store.addMensagem({ conversa_id: conversa.id, direcao: 'humano', texto, wa_id: waId });
    if (conversa.estado === 'ativa') await assumir(conversa.id, 'Gabriel enviou mensagem pelo CRM');
  }

  /** Depois de uma pausa (painel, horário ou PARAR.txt): responde quem escreveu enquanto o bot estava parado. */
  async function retomarPendentes() {
    const conversas = await store.conversasAtivas();
    let n = 0;
    for (const c of conversas) {
      const historico = await store.historico(c.id);
      const ultima = historico[historico.length - 1];
      if (!ultima || ultima.direcao !== 'lead') continue;
      if (Date.now() - Date.parse(ultima.criado_em) > config.maxIdadeLeadHoras * 3600 * 1000) continue;
      agendarResposta(c.id, aleatorio(2000, 8000));
      n += 1;
    }
    if (n) log.info(`[bot] retomando ${n} conversa(s) que ficaram sem resposta durante a pausa.`);
    return n;
  }

  function pararTimers() {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  }

  return { processarNovosLeads, aoReceber, aoHumano, responder, assumir, devolver, enviarComoGabriel, retomarPendentes, pararTimers, _dividir: dividirMensagens };
}
