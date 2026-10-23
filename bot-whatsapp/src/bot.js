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
import { dentroDaJanelaAutomatica, lembreteDevido, montarFollowup, montarMensagemConsultoria, proximoFollowup } from './acompanhamento.js';
import { citouHonorarios } from './funil.js';
import { dividirMensagens, pediuParar, validarSaida } from './guards.js';
import { montarAbertura } from './opening.js';
import { aleatorio, calcularHonorario, dormir, formatarReaisInteiros, limparNomeInformado, normalizarTelefoneBR } from './util.js';

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
  const followupsFeitos = new Set(); // 'conversa:nível:última mensagem' já enviados nesta execução (trava extra contra repetição)
  const lembretesFeitos = new Set(); // 'lembrete:agendamento:tipo'
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

  /** Modo de teste: só fala com os números da lista (mesma regra da abertura). */
  function foraDaListaTeste(telefone) {
    return config.listaTeste.length > 0 && !config.listaTeste.some((n) => String(telefone).endsWith(n) || n.endsWith(String(telefone)));
  }

  /**
   * Lead com economia alta (acima do mesmo limite da reunião): avisa o Gabriel por e-mail, uma vez por tipo de aviso,
   * para ele entrar pessoalmente (áudio de 1 minuto ou ligação) enquanto o lead está quente.
   */
  async function avisarLeadGrande(conversa, lead, tipoAviso, historico = []) {
    try {
      if (!lead || lead.responsavel === 'PJ') return;
      const eco = Number(lead.economia_estimada);
      if (!Number.isFinite(eco) || eco < config.economiaMinParaReuniao) return;
      const chave = `grande:${conversa.id}:${tipoAviso}`;
      if (await store.lerEstado(chave)) return;
      await store.gravarEstado(chave, new Date().toISOString());
      const h = calcularHonorario(lead);
      const honor = h.economiaConhecida ? ` (honorário em torno de ${formatarReaisInteiros(h.valor)})` : '';
      const motivo =
        tipoAviso === 'resposta'
          ? `Lead de valor alto acabou de responder: economia estimada de ${formatarReaisInteiros(eco)}${honor}. Vale mandar um áudio seu de 1 minuto ou ligar enquanto ele está quente.`
          : `Lead de valor alto ficou sem responder: economia estimada de ${formatarReaisInteiros(eco)}${honor}. Vale um áudio seu de 1 minuto ou uma ligação para retomar.`;
      await notificar.avisar({ tipo: tipoAviso === 'resposta' ? 'Lead grande respondeu' : 'Lead grande sem resposta', lead, telefone: conversa.telefone, motivo, historico });
    } catch (e) {
      log.warn(`[bot] não consegui avisar sobre lead grande: ${e.message}`);
    }
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

  /**
   * Leads que o bot abordou há mais de `horas` e nunca responderam vão para a coluna
   * "Sem resposta" do CRM (ficam lá até responderem; a conversa continua ativa).
   */
  async function marcarSemResposta(horas = 24) {
    const ids = await store.leadsSemResposta(horas);
    for (const id of ids) {
      try {
        await store.atualizarLead(id, { status: 'sem_resposta', nota: `Lead não respondeu em ${horas}h.` });
        const conversa = await store.conversaPorLead(id);
        if (conversa) await avisarLeadGrande(conversa, await store.leadPorId(id), 'sumiu', await store.historico(conversa.id));
      } catch (e) {
        log.warn(`[bot] não consegui mover o card para "Sem resposta": ${e.message}`);
      }
    }
    return ids.length;
  }

  /**
   * Acompanhamento de quem parou de responder. Quando o bot foi o último a falar e o silêncio dura ~1 dia, ~3 dias e ~7 dias,
   * manda uma mensagem curta (modelos de acompanhamento.js). Respeita as travas (bot parado, horário 8h–20h, teto, lista de teste)
   * e nunca insiste com quem pediu para parar, com quem já agendou ou com conversa que está com o Gabriel.
   */
  async function processarFollowups({ agora = new Date() } = {}) {
    if (config.followupAtivo === false || parado() || !wa.conectado() || !dentroDaJanelaAutomatica(agora)) return 0;
    const conversas = await store.conversasParaFollowup();
    let enviados = 0;
    for (const c of conversas) {
      if (enviados >= 5 || parado()) break;
      if ((c.observacao || '').startsWith(MARCA_ESPERA)) continue; // está esperando o Gabriel, não o lead
      if (emAndamento.has(c.id) || timers.has(c.id)) continue;
      if (foraDaListaTeste(c.telefone)) continue;
      const historico = await store.historico(c.id);
      const ultima = historico[historico.length - 1];
      const nivel = proximoFollowup({ nivelAtual: c.followup_nivel ?? 0, ultimaDirecao: ultima?.direcao, ultimaEm: ultima?.criado_em, agora: agora.getTime() });
      const chaveFollowup = `${c.id}:${nivel}:${ultima?.id}`; // mesma conversa, mesmo nível, mesma última mensagem = já tratado
      if (!nivel || followupsFeitos.has(chaveFollowup)) continue;
      const lead = await store.leadPorId(c.lead_id);
      if (!lead || ['agendado', 'fechado', 'perdido'].includes(lead.status)) continue;
      if (!(await abaixoDoTeto())) {
        await avisarTeto();
        break;
      }
      followupsFeitos.add(chaveFollowup);
      try {
        await store.registrarFollowup(c.id, nivel); // registra ANTES de enviar: se falhar aqui, não envia (evita repetir)
      } catch (e) {
        log.warn(`[bot] não consegui registrar o acompanhamento (rodou o supabase_bot_painel.sql de novo?): ${e.message}`);
        continue;
      }
      const texto = montarFollowup({ lead, nivel, respondeuAntes: historico.some((m) => m.direcao === 'lead'), nomeContato: c.nome_contato || '' });
      const v = validarSaida(texto, lead);
      if (!v.ok) {
        log.error(`[bot] acompanhamento bloqueado (${v.motivo})`);
        continue;
      }
      try {
        await enviar(c, texto);
        enviados += 1;
        log.info(`[bot] acompanhamento ${nivel} enviado para ${lead.nome || lead.id}`);
      } catch (e) {
        log.warn(`[bot] falha ao enviar acompanhamento: ${e.message}`);
      }
    }
    return enviados;
  }

  /**
   * Mensagens ligadas à consultoria gratuita (tabela agendamentos): lembrete 24h e 1h antes; pós-consultoria quando o Gabriel marca
   * "Realizado" na aba Agenda; oferta de remarcar quando marca "Não compareceu". Só para quem já tem conversa ativa com o bot.
   */
  async function processarConsultorias({ agora = new Date() } = {}) {
    if (config.lembretesAtivo === false || parado() || !wa.conectado() || !dentroDaJanelaAutomatica(agora)) return 0;
    const lista = await store.agendamentosRecentes();
    let enviados = 0;
    for (const a of lista) {
      const devidos = lembreteDevido({ status: a.status, inicio: a.inicio, fim: a.fim, criadoEm: a.created_at, agora: agora.getTime() });
      if (!devidos.length) continue;
      const telefone = normalizarTelefoneBR(a.whatsapp);
      if (!telefone) continue;
      const conversa = await store.conversaPorTelefone(telefone);
      if (!conversa || conversa.estado !== 'ativa' || foraDaListaTeste(conversa.telefone)) continue;
      const lead = await store.leadPorId(conversa.lead_id);
      for (const tipo of devidos) {
        const chave = `lembrete:${a.id}:${tipo}`;
        if (lembretesFeitos.has(chave)) continue;
        lembretesFeitos.add(chave);
        if (await store.lerEstado(chave)) continue;
        if (!(await abaixoDoTeto())) {
          await avisarTeto();
          lembretesFeitos.delete(chave);
          return enviados;
        }
        try {
          await store.gravarEstado(chave, new Date().toISOString()); // registra ANTES de enviar
        } catch (e) {
          log.warn(`[bot] não consegui registrar o lembrete: ${e.message}`);
          continue;
        }
        const texto = montarMensagemConsultoria({ tipo, lead, inicio: a.inicio, nomeContato: conversa.nome_contato || '', agora });
        const v = validarSaida(texto, lead || {});
        if (!v.ok) {
          log.error(`[bot] lembrete bloqueado (${v.motivo})`);
          continue;
        }
        try {
          await enviar(conversa, texto);
          enviados += 1;
          log.info(`[bot] mensagem da consultoria (${tipo}) enviada para ${a.nome}`);
        } catch (e) {
          log.warn(`[bot] falha ao enviar mensagem da consultoria: ${e.message}`);
        }
      }
    }
    return enviados;
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

    // O lead respondeu: se o card estava em "Sem resposta", volta para "Contatado".
    if (lead?.status === 'sem_resposta') {
      try {
        await store.atualizarLead(conversa.lead_id, { status: 'contatado' });
      } catch (e) {
        log.warn(`[bot] não consegui tirar o card de "Sem resposta": ${e.message}`);
      }
    }

    // O lead respondeu: a contagem dos acompanhamentos (24h / 3 dias / 7 dias) recomeça do zero.
    if ((conversa.followup_nivel ?? 0) > 0) {
      try {
        await store.zerarFollowup(conversa.id);
      } catch (e) {
        log.warn(`[bot] não consegui zerar o acompanhamento: ${e.message}`);
      }
    }

    if (tipo === 'texto' && pediuParar(conteudo)) {
      cancelarTimer(conversa.id);
      await enviar(conversa, 'Tudo bem, não te envio mais mensagens. Obrigado pelo seu tempo!');
      await store.setEstado(conversa.id, 'optout', 'pediu para parar');
      await store.atualizarLead(conversa.lead_id, { status: 'perdido', nota: 'Pediu para não receber mais mensagens.', motivoPerda: 'pediu_para_parar' });
      return;
    }

    await avisarLeadGrande(conversa, lead, 'resposta', historico);

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
    let nomeAtual = conversa.nome_contato || '';
    return {
      ver_horarios: () => site.verHorarios(),
      agendar_consultoria: async ({ inicio, email }) => {
        const r = await site.agendar({
          nome: nomeAtual || lead.nome,
          email,
          whatsapp: lead.whatsapp,
          inicio,
          observacoes: 'Agendado pela assistente de WhatsApp.',
        });
        if (r.ok) {
          try {
            // Card vai para a coluna "Agendamento" do CRM.
            await store.atualizarLead(lead.id, { status: 'agendado', nota: `Consultoria agendada pelo bot para ${r.confirmado_para}.` });
          } catch (e) {
            log.warn(`[bot] agendou, mas não consegui mover o card para "Agendamento" (rodou o supabase_bot_painel.sql de novo?): ${e.message}`);
          }
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
      registrar_nome: async ({ nome }) => {
        const limpo = limparNomeInformado(nome);
        if (!limpo) return { ok: false, erro: 'isso não parece um nome; pergunte de novo' };
        nomeAtual = limpo;
        try {
          await store.salvarNomeContato(conversa.id, limpo);
        } catch (e) {
          log.warn(`[bot] não consegui guardar o nome (rodou o supabase_bot_painel.sql de novo?): ${e.message}`);
        }
        await store.atualizarLead(lead.id, { nota: `Nome informado no WhatsApp: ${limpo}` });
        return { ok: true, nome: limpo };
      },
      registrar_status: async ({ status, nota, motivo_perda: motivoPerda }) => {
        await store.atualizarLead(lead.id, { status, nota, motivoPerda });
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
        resultado = await cerebro.gerarResposta({ lead, historico, ferramentas: montarFerramentas(conversa, lead), log, espera: emEspera ? motivoEspera : null, nomeContato: conversa.nome_contato || '' });
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

      // Falou dos honorários? Então a proposta foi apresentada: card vai para "Proposta enviada".
      if (resultado.mensagens.some(citouHonorarios)) {
        try {
          await store.atualizarLead(lead.id, { status: 'proposta_enviada', nota: 'Bot apresentou os honorários ao lead.' });
        } catch (e) {
          log.warn(`[bot] não consegui mover o card para "Proposta enviada": ${e.message}`);
        }
      }

      const acao = resultado.acao;
      if (acao?.tipo === 'passar') {
        const hist = await store.historico(conversaId);
        const detalhe = `${acao.motivo}${acao.resumo ? ` — ${acao.resumo}` : ''}`;
        // O lead aceitou uma ligação rápida hoje: aviso próprio e sempre imediato (não entra na trava de 30 min).
        const ligacao = /^\s*liga[cç][aã]o hoje/i.test(acao.motivo || '');
        if (ligacao) {
          avisosEspera.set(conversaId, Date.now());
          if (!emEspera) await store.setEstado(conversaId, 'ativa', `${MARCA_ESPERA}${acao.motivo}`);
          try {
            await store.atualizarLead(lead.id, { nota: `LIGAR HOJE: ${acao.resumo || acao.motivo}`.trim() });
          } catch (e) {
            log.warn(`[bot] não consegui gravar a nota da ligação: ${e.message}`);
          }
          await notificar.avisar({ tipo: 'LIGAR HOJE', lead, telefone: conversa.telefone, motivo: detalhe, historico: hist });
        } else if (emEspera) {
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
        await store.atualizarLead(lead.id, { status: 'perdido', nota: `Conversa encerrada pelo bot: ${acao.motivo}`, motivoPerda: acao.motivo_perda || 'outro' });
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

  return { processarNovosLeads, marcarSemResposta, processarFollowups, processarConsultorias, aoReceber, aoHumano, responder, assumir, devolver, enviarComoGabriel, retomarPendentes, pararTimers, _dividir: dividirMensagens };
}
