/**
 * Acesso ao Supabase: leads do site (tabela `leads`) e conversas do bot
 * (tabelas `bot_conversas`, `bot_mensagens`, `bot_estado` — ver supabase_bot.sql).
 */
import { createClient } from '@supabase/supabase-js';

const STATUS_PROTEGIDOS = ['fechado'];

function carimbo() {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function checar({ data, error }, contexto) {
  if (error) throw new Error(`Supabase (${contexto}): ${error.message}`);
  return data;
}

export function criarStore({ url, key }) {
  const db = createClient(url, key, { auth: { persistSession: false } });

  return {
    /** Momento em que o bot foi ligado pela primeira vez. Leads anteriores a ele nunca são contatados. */
    async inicioDoBot() {
      const atual = checar(await db.from('bot_estado').select('valor').eq('chave', 'inicio_do_bot').maybeSingle(), 'ler início');
      if (atual?.valor) return atual.valor;
      const agora = new Date().toISOString();
      checar(await db.from('bot_estado').upsert({ chave: 'inicio_do_bot', valor: agora }), 'gravar início');
      return agora;
    },

    async leadsNovos(desdeIso) {
      return (
        checar(
          await db
            .from('leads')
            .select('*')
            .eq('status', 'novo')
            .gte('created_at', desdeIso)
            .order('created_at', { ascending: true })
            .limit(25),
          'leads novos'
        ) || []
      );
    },

    async leadPorId(id) {
      return checar(await db.from('leads').select('*').eq('id', id).maybeSingle(), 'lead por id');
    },

    async conversaPorLead(leadId) {
      return checar(await db.from('bot_conversas').select('*').eq('lead_id', leadId).maybeSingle(), 'conversa por lead');
    },

    /** Cria a conversa ANTES de enviar qualquer coisa. Retorna null se já existia (evita envio duplicado). */
    async criarConversa({ lead_id, telefone, jid, estado = 'ativa', observacao = null }) {
      const { data, error } = await db
        .from('bot_conversas')
        .insert({ lead_id, telefone, jid, estado, observacao })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') return null;
        throw new Error(`Supabase (criar conversa): ${error.message}`);
      }
      return data;
    },

    async conversaPorTelefone(digitos) {
      const exata = checar(
        await db.from('bot_conversas').select('*').eq('telefone', digitos).order('criado_em', { ascending: false }).limit(1),
        'conversa por telefone'
      );
      if (exata && exata.length) return exata[0];
      // O WhatsApp às vezes entrega números antigos sem o 9º dígito: compara DDD + últimos 8 dígitos.
      if (digitos.length >= 12) {
        const padrao = `${digitos.slice(0, 4)}%${digitos.slice(-8)}`;
        const aprox = checar(
          await db.from('bot_conversas').select('*').like('telefone', padrao).order('criado_em', { ascending: false }).limit(1),
          'conversa por telefone (aprox.)'
        );
        if (aprox && aprox.length) return aprox[0];
      }
      return null;
    },

    async conversaPorId(id) {
      return checar(await db.from('bot_conversas').select('*').eq('id', id).maybeSingle(), 'conversa por id');
    },

    async setEstado(id, estado, observacao) {
      const patch = { estado, atualizado_em: new Date().toISOString() };
      if (observacao !== undefined) patch.observacao = observacao;
      checar(await db.from('bot_conversas').update(patch).eq('id', id), 'estado da conversa');
    },

    async addMensagem({ conversa_id, direcao, texto, wa_id = null }) {
      checar(await db.from('bot_mensagens').insert({ conversa_id, direcao, texto, wa_id }), 'gravar mensagem');
    },

    async historico(conversaId, limite = 40) {
      const linhas = checar(
        await db
          .from('bot_mensagens')
          .select('direcao,texto,criado_em')
          .eq('conversa_id', conversaId)
          .order('criado_em', { ascending: false })
          .limit(limite),
        'histórico'
      );
      return (linhas || []).reverse();
    },

    async contarMensagensBot(desdeIso) {
      const { count, error } = await db
        .from('bot_mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('direcao', 'bot')
        .gte('criado_em', desdeIso);
      if (error) throw new Error(`Supabase (contar): ${error.message}`);
      return count || 0;
    },

    // ----------------------------------------------------------------------- painel do CRM
    async lerConfigRemota() {
      return checar(await db.from('bot_config').select('*').eq('id', 1).maybeSingle(), 'ler configurações do painel');
    },

    async criarConfigRemota(linha) {
      checar(await db.from('bot_config').upsert(linha, { onConflict: 'id', ignoreDuplicates: true }), 'criar configurações do painel');
    },

    async lerEstado(chave) {
      const r = checar(await db.from('bot_estado').select('valor').eq('chave', chave).maybeSingle(), `ler ${chave}`);
      return r?.valor ?? null;
    },

    async gravarEstado(chave, valor) {
      checar(await db.from('bot_estado').upsert({ chave, valor }), `gravar ${chave}`);
    },

    async gravarHeartbeat(obj) {
      checar(await db.from('bot_estado').upsert({ chave: 'heartbeat', valor: JSON.stringify(obj) }), 'sinal de vida');
    },

    async comandosPendentes() {
      return (
        checar(
          await db.from('bot_comandos').select('*').eq('status', 'pendente').order('criado_em', { ascending: true }).limit(20),
          'comandos pendentes'
        ) || []
      );
    },

    async marcarComando(id, { status, erro = null }) {
      checar(
        await db.from('bot_comandos').update({ status, erro, processado_em: new Date().toISOString() }).eq('id', id),
        'marcar comando'
      );
    },

    async listarConhecimento() {
      return checar(await db.from('bot_conhecimento').select('*').order('ordem', { ascending: true }).order('id', { ascending: true }), 'conhecimento');
    },

    /** Copia para o banco os arquivos da pasta conhecimento que ainda não estão lá (não sobrescreve edições do CRM). */
    async semearConhecimento(itens) {
      checar(await db.from('bot_conhecimento').upsert(itens, { onConflict: 'chave', ignoreDuplicates: true }), 'semear conhecimento');
    },

    async registrarUso({ conversa_id, entrada, saida }) {
      checar(await db.from('bot_uso').insert({ conversa_id, entrada, saida }), 'registrar uso');
    },

    async salvarNomeContato(conversaId, nome) {
      checar(await db.from('bot_conversas').update({ nome_contato: nome }).eq('id', conversaId), 'salvar nome do contato');
    },

    async marcarAgendou(conversaId) {
      checar(await db.from('bot_conversas').update({ agendou_em: new Date().toISOString() }).eq('id', conversaId), 'marcar agendamento');
    },

    /** Conversas ainda ativas (para retomar quem escreveu enquanto o bot estava pausado). */
    async conversasAtivas() {
      return (
        checar(await db.from('bot_conversas').select('*').eq('estado', 'ativa').order('atualizado_em', { ascending: false }).limit(100), 'conversas ativas') || []
      );
    },

    /** Atualiza o funil do CRM sem passar por cima de leads já fechados. */
    async atualizarLead(leadId, { status, nota }) {
      const atual = checar(await db.from('leads').select('status,notas').eq('id', leadId).maybeSingle(), 'ler lead');
      if (!atual) return;
      const patch = {};
      if (status && !STATUS_PROTEGIDOS.includes(atual.status)) patch.status = status;
      if (nota) patch.notas = `${atual.notas ? `${atual.notas}\n` : ''}[Bot WhatsApp ${carimbo()}] ${nota}`;
      if (Object.keys(patch).length === 0) return;
      checar(await db.from('leads').update(patch).eq('id', leadId), 'atualizar lead');
    },
  };
}
