import { supabase } from './supabaseClient';

/**
 * ============================================================================
 *  CAMADA DE DADOS DO PAINEL DO BOT (aba "Bot" do CRM)
 * ============================================================================
 * O bot de WhatsApp roda no computador do Gabriel (pasta `bot-whatsapp/`) e
 * conversa com o CRM só pelo Supabase:
 *   - configurações     -> tabela `bot_config`        (CRM escreve, bot lê)
 *   - conhecimento      -> tabela `bot_conhecimento`  (CRM escreve, bot lê)
 *   - comandos          -> tabela `bot_comandos`      (CRM cria, bot executa)
 *   - conversas/mensagens/status/consumo (bot escreve, CRM lê)
 * As tabelas são criadas pelo arquivo `bot-whatsapp/supabase_bot_painel.sql`.
 * ============================================================================
 */

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase não configurado — defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

export type BotEstadoConversa = 'ativa' | 'humano' | 'encerrada' | 'optout';
export type BotDirecao = 'lead' | 'bot' | 'humano';

export interface BotConfig {
  ativo: boolean;
  assistenteNome: string;
  tetoMensagens24h: number;
  economiaMinReuniao: number;
  listaTeste: string;
  horarioAtivo: boolean;
  horarioInicio: string;
  horarioFim: string;
  cambioUsdBrl: number;
  aprendizadoAtivo: boolean;
}

interface BotConfigRow {
  ativo: boolean;
  assistente_nome: string;
  teto_mensagens_24h: number;
  economia_min_reuniao: number;
  lista_teste: string;
  horario_ativo: boolean;
  horario_inicio: string;
  horario_fim: string;
  cambio_usd_brl: number;
  aprendizado_ativo?: boolean | null;
}

export interface BotHeartbeat {
  ts: string;
  versao: string;
  whatsapp: boolean;
  pausado: boolean;
  motivoPausa: string | null;
  listaTeste: number;
  modoTeste: boolean;
}

export interface BotConversa {
  id: string;
  leadId: string;
  telefone: string;
  estado: BotEstadoConversa;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
  agendouEm: string | null;
  nomeContato: string | null;
}

interface BotConversaRow {
  id: string;
  lead_id: string;
  telefone: string;
  estado: BotEstadoConversa;
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
  agendou_em: string | null;
  nome_contato?: string | null;
}

export interface BotMensagem {
  id: number;
  conversaId: string;
  direcao: BotDirecao;
  texto: string;
  criadoEm: string;
}

interface BotMensagemRow {
  id: number;
  conversa_id: string;
  direcao: BotDirecao;
  texto: string;
  criado_em: string;
}

/** Versão enxuta de mensagem, só para métricas (sem o texto). */
export interface BotMensagemResumo {
  conversaId: string;
  direcao: BotDirecao;
  criadoEm: string;
}

export interface BotUso {
  entrada: number;
  saida: number;
  criadoEm: string;
}

export interface BotAprendizado {
  id: number;
  conversaId: string | null;
  topico: string;
  pergunta: string;
  resposta: string;
  ativo: boolean;
  criadoEm: string;
}

interface BotAprendizadoRow {
  id: number;
  conversa_id: string | null;
  topico: string | null;
  pergunta: string;
  resposta: string;
  ativo: boolean;
  criado_em: string;
}

export type BotComandoTipo = 'enviar' | 'assumir' | 'devolver';
export type BotComandoStatus = 'pendente' | 'feito' | 'erro';

export interface BotComando {
  id: number;
  status: BotComandoStatus;
  erro: string | null;
}

export interface BotConhecimento {
  id: number;
  chave: string | null;
  titulo: string;
  conteudo: string;
  ativo: boolean;
  ordem: number;
}

function rowToConfig(r: BotConfigRow): BotConfig {
  return {
    ativo: r.ativo,
    assistenteNome: r.assistente_nome,
    tetoMensagens24h: r.teto_mensagens_24h,
    economiaMinReuniao: Number(r.economia_min_reuniao),
    listaTeste: r.lista_teste ?? '',
    horarioAtivo: r.horario_ativo,
    horarioInicio: r.horario_inicio,
    horarioFim: r.horario_fim,
    cambioUsdBrl: Number(r.cambio_usd_brl),
    aprendizadoAtivo: r.aprendizado_ativo !== false,
  };
}

function configToRow(c: Partial<BotConfig>): Partial<BotConfigRow> & { atualizado_em: string } {
  const row: Partial<BotConfigRow> & { atualizado_em: string } = { atualizado_em: new Date().toISOString() };
  if (c.ativo !== undefined) row.ativo = c.ativo;
  if (c.assistenteNome !== undefined) row.assistente_nome = c.assistenteNome;
  if (c.tetoMensagens24h !== undefined) row.teto_mensagens_24h = c.tetoMensagens24h;
  if (c.economiaMinReuniao !== undefined) row.economia_min_reuniao = c.economiaMinReuniao;
  if (c.listaTeste !== undefined) row.lista_teste = c.listaTeste;
  if (c.horarioAtivo !== undefined) row.horario_ativo = c.horarioAtivo;
  if (c.horarioInicio !== undefined) row.horario_inicio = c.horarioInicio;
  if (c.horarioFim !== undefined) row.horario_fim = c.horarioFim;
  if (c.cambioUsdBrl !== undefined) row.cambio_usd_brl = c.cambioUsdBrl;
  if (c.aprendizadoAtivo !== undefined) row.aprendizado_ativo = c.aprendizadoAtivo;
  return row;
}

export const botService = {
  /** Configurações atuais. Retorna null se o bot ainda não criou a linha (nunca foi ligado com o painel). */
  async getConfig(): Promise<BotConfig | null> {
    const client = requireClient();
    const { data, error } = await client.from('bot_config').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data ? rowToConfig(data as BotConfigRow) : null;
  },

  async updateConfig(patch: Partial<BotConfig>): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('bot_config').update(configToRow(patch)).eq('id', 1);
    if (error) throw error;
  },

  /** Último "sinal de vida" gravado pelo bot (a cada 15 s). */
  async getHeartbeat(): Promise<BotHeartbeat | null> {
    const client = requireClient();
    const { data, error } = await client.from('bot_estado').select('valor').eq('chave', 'heartbeat').maybeSingle();
    if (error) throw error;
    if (!data?.valor) return null;
    try {
      const raw = JSON.parse(data.valor as string) as {
        ts: string;
        versao?: string;
        whatsapp?: boolean;
        pausado?: boolean;
        motivo_pausa?: string | null;
        lista_teste?: number;
        modo_teste?: boolean;
      };
      return {
        ts: raw.ts,
        versao: raw.versao ?? '',
        whatsapp: Boolean(raw.whatsapp),
        pausado: Boolean(raw.pausado),
        motivoPausa: raw.motivo_pausa ?? null,
        listaTeste: raw.lista_teste ?? 0,
        modoTeste: Boolean(raw.modo_teste),
      };
    } catch {
      return null;
    }
  },

  async listConversas(): Promise<BotConversa[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('bot_conversas')
      .select('*')
      .order('atualizado_em', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as BotConversaRow[]).map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      telefone: r.telefone,
      estado: r.estado,
      observacao: r.observacao,
      criadoEm: r.criado_em,
      atualizadoEm: r.atualizado_em,
      agendouEm: r.agendou_em,
      nomeContato: r.nome_contato ?? null,
    }));
  },

  async listMensagens(conversaId: string): Promise<BotMensagem[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('bot_mensagens')
      .select('id,conversa_id,direcao,texto,criado_em')
      .eq('conversa_id', conversaId)
      .order('criado_em', { ascending: true })
      .limit(500);
    if (error) throw error;
    return (data as BotMensagemRow[]).map((r) => ({
      id: r.id,
      conversaId: r.conversa_id,
      direcao: r.direcao,
      texto: r.texto,
      criadoEm: r.criado_em,
    }));
  },

  /** Mensagens dos últimos `dias` dias, sem o texto (para métricas e para o resumo da lista de conversas). */
  async listMensagensResumo(dias: number): Promise<BotMensagemResumo[]> {
    const client = requireClient();
    const desde = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
    const { data, error } = await client
      .from('bot_mensagens')
      .select('conversa_id,direcao,criado_em')
      .gte('criado_em', desde)
      .order('criado_em', { ascending: false })
      .limit(20000);
    if (error) throw error;
    return (data as { conversa_id: string; direcao: BotDirecao; criado_em: string }[]).map((r) => ({
      conversaId: r.conversa_id,
      direcao: r.direcao,
      criadoEm: r.criado_em,
    }));
  },

  async listUso(dias: number): Promise<BotUso[]> {
    const client = requireClient();
    const desde = new Date(Date.now() - dias * 24 * 3600 * 1000).toISOString();
    const { data, error } = await client
      .from('bot_uso')
      .select('entrada,saida,criado_em')
      .gte('criado_em', desde)
      .limit(20000);
    if (error) throw error;
    return (data as { entrada: number; saida: number; criado_em: string }[]).map((r) => ({
      entrada: r.entrada,
      saida: r.saida,
      criadoEm: r.criado_em,
    }));
  },

  /** Manda um comando para o bot executar (ele confere a fila a cada poucos segundos). Retorna o id. */
  async sendComando(tipo: BotComandoTipo, conversaId: string, texto?: string): Promise<number> {
    const client = requireClient();
    const { data, error } = await client
      .from('bot_comandos')
      .insert({ tipo, conversa_id: conversaId, texto: texto ?? null, status: 'pendente' })
      .select('id')
      .single();
    if (error) throw error;
    return (data as { id: number }).id;
  },

  async getComando(id: number): Promise<BotComando | null> {
    const client = requireClient();
    const { data, error } = await client.from('bot_comandos').select('id,status,erro').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as BotComando | null) ?? null;
  },

  async listConhecimento(): Promise<BotConhecimento[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('bot_conhecimento')
      .select('*')
      .order('ordem', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    return data as BotConhecimento[];
  },

  async saveConhecimento(item: Pick<BotConhecimento, 'id' | 'titulo' | 'conteudo' | 'ativo'>): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('bot_conhecimento')
      .update({
        titulo: item.titulo,
        conteudo: item.conteudo,
        ativo: item.ativo,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) throw error;
  },

  async createConhecimento(titulo: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('bot_conhecimento').insert({ titulo, conteudo: '', ativo: true, ordem: 200 });
    if (error) throw error;
  },

  async deleteConhecimento(id: number): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('bot_conhecimento').delete().eq('id', id);
    if (error) throw error;
  },

  /** Conhecimento que o bot aprendeu sozinho com as respostas do Gabriel (mais novos primeiro). */
  async listAprendizado(): Promise<BotAprendizado[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('bot_aprendizado')
      .select('*')
      .order('id', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as BotAprendizadoRow[]).map((r) => ({
      id: r.id,
      conversaId: r.conversa_id,
      topico: r.topico ?? '',
      pergunta: r.pergunta,
      resposta: r.resposta,
      ativo: r.ativo,
      criadoEm: r.criado_em,
    }));
  },

  async saveAprendizado(item: Pick<BotAprendizado, 'id' | 'topico' | 'pergunta' | 'resposta' | 'ativo'>): Promise<void> {
    const client = requireClient();
    const { error } = await client
      .from('bot_aprendizado')
      .update({
        topico: item.topico,
        pergunta: item.pergunta,
        resposta: item.resposta,
        ativo: item.ativo,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', item.id);
    if (error) throw error;
  },

  async deleteAprendizado(id: number): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('bot_aprendizado').delete().eq('id', id);
    if (error) throw error;
  },
};
