import { supabase } from './supabaseClient';
import type { GuiaLead, Lead, LeadStatus } from '@/types/lead';

/**
 * ============================================================================
 *  CAMADA DE DADOS DO CRM (área interna /crm.html)
 * ============================================================================
 * Independente do `leadService.ts` (usado pela calculadora pública). Aqui
 * quem fala com o Supabase é sempre um usuário autenticado (Gabriel), lendo
 * e atualizando a tabela `leads` — nunca criando leads novos (isso é
 * responsabilidade só da função serverless `/api/notify-lead.js`).
 * ============================================================================
 */

/** Formato bruto de uma linha da tabela `leads` no Supabase (snake_case). */
interface LeadRow {
  id: string;
  nome: string | null;
  whatsapp: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  responsavel: string | null;
  tipo_obra: string | null;
  situacao: string | null;
  categoria: string | null;
  estado: string | null;
  destinacao: string | null;
  area_principal: number | null;
  area_piscina: number | null;
  observacoes: string | null;
  inss_estimado: number | null;
  economia_estimada: number | null;
  percentual_reducao: number | null;
  valor_apos_reducao: number | null;
  created_at: string;
  status: LeadStatus;
  notas: string | null;
  valor_fechado: number | null;
  honorarios: number | null;
  updated_at: string;
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    nome: row.nome ?? '',
    whatsapp: row.whatsapp ?? '',
    dataInicio: row.data_inicio ?? '',
    dataFim: row.data_fim ?? '',
    responsavel: (row.responsavel ?? '') as Lead['responsavel'],
    tipoObra: (row.tipo_obra ?? '') as Lead['tipoObra'],
    situacao: (row.situacao ?? '') as Lead['situacao'],
    categoria: (row.categoria ?? '') as Lead['categoria'],
    estado: row.estado ?? '',
    destinacao: (row.destinacao ?? '') as Lead['destinacao'],
    areaPrincipal: row.area_principal,
    areaPiscina: row.area_piscina,
    observacoes: row.observacoes ?? '',
    inssEstimado: row.inss_estimado,
    economiaEstimada: row.economia_estimada,
    percentualReducao: row.percentual_reducao,
    valorAposReducao: row.valor_apos_reducao,
    detalheInterno: null,
    createdAt: row.created_at,
    status: row.status ?? 'novo',
    notas: row.notas,
    valorFechado: row.valor_fechado,
    honorarios: row.honorarios,
    updatedAt: row.updated_at,
  };
}

function requireClient() {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado — defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente.'
    );
  }
  return supabase;
}

export const crmAuth = {
  /** Retorna a sessão atual (ou null se não estiver logado). */
  async getSession() {
    const client = requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /** Escuta mudanças de autenticação (login/logout/expiração de sessão). */
  onAuthStateChange(callback: (isLoggedIn: boolean) => void) {
    const client = requireClient();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      callback(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  },

  async signIn(email: string, password: string) {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  async signOut() {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  },
};

export const crmLeadService = {
  /** Lista todos os leads, mais recentes primeiro. */
  async listLeads(): Promise<Lead[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as LeadRow[]).map(rowToLead);
  },

  /** Atualiza o status (etapa do funil) de um lead. */
  async updateStatus(id: string, status: LeadStatus): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('leads').update({ status }).eq('id', id);
    if (error) throw error;
  },

  /** Atualiza as anotações livres de um lead. */
  async updateNotas(id: string, notas: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('leads').update({ notas }).eq('id', id);
    if (error) throw error;
  },

  /** Define o valor efetivamente fechado com o cliente (só faz sentido quando status = 'fechado'). */
  async updateValorFechado(id: string, valorFechado: number | null): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('leads').update({ valor_fechado: valorFechado }).eq('id', id);
    if (error) throw error;
  },

  /** Define os honorários efetivamente cobrados nesse lead (uso interno do Gabriel). */
  async updateHonorarios(id: string, honorarios: number | null): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('leads').update({ honorarios }).eq('id', id);
    if (error) throw error;
  },

  /** Remove um lead (ex: teste, duplicado, spam). */
  async deleteLead(id: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('leads').delete().eq('id', id);
    if (error) throw error;
  },
};

/** Formato bruto de uma linha da tabela `guia_leads` no Supabase (snake_case). */
interface GuiaLeadRow {
  id: string;
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  material: string | null;
  created_at: string;
}

function rowToGuiaLead(row: GuiaLeadRow): GuiaLead {
  return {
    id: row.id,
    nome: row.nome ?? '',
    email: row.email ?? '',
    whatsapp: row.whatsapp ?? '',
    material: row.material ?? '',
    createdAt: row.created_at,
  };
}

/**
 * Camada de dados dos contatos que baixaram algum guia gratuito em PDF
 * (tabela `guia_leads`) — usada só pela aba "Guia" do CRM.
 */
export const crmGuiaLeadService = {
  /** Lista todos os contatos que baixaram algum guia, mais recentes primeiro. */
  async listGuiaLeads(): Promise<GuiaLead[]> {
    const client = requireClient();
    const { data, error } = await client
      .from('guia_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as GuiaLeadRow[]).map(rowToGuiaLead);
  },

  /** Remove um contato (ex: teste, duplicado, spam). */
  async deleteGuiaLead(id: string): Promise<void> {
    const client = requireClient();
    const { error } = await client.from('guia_leads').delete().eq('id', id);
    if (error) throw error;
  },
};

/** Formato bruto de uma linha da tabela `page_views` no Supabase (snake_case). */
interface PageViewRow {
  id: number;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  visitor_id: string | null;
  created_at: string;
}

/** Uma visualização de página (tráfego do site público), lida da tabela `page_views`. */
export interface PageView {
  id: number;
  path: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  visitorId: string | null;
  createdAt: string;
}

function rowToPageView(row: PageViewRow): PageView {
  return {
    id: row.id,
    path: row.path,
    referrer: row.referrer,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    visitorId: row.visitor_id,
    createdAt: row.created_at,
  };
}

/**
 * Camada de dados do tráfego do site (tabela `page_views`) — usada só pela
 * aba "Tráfego" do CRM. Gravada só pela função serverless
 * `/api/track-pageview.js` (chave service_role); aqui só lemos.
 */
export const crmTrafficService = {
  /** Últimos 180 dias de visualizações, mais recentes primeiro (limite de segurança: 20.000 linhas). */
  async listPageViews(): Promise<PageView[]> {
    const client = requireClient();
    const desde = new Date();
    desde.setDate(desde.getDate() - 180);

    const { data, error } = await client
      .from('page_views')
      .select('*')
      .gte('created_at', desde.toISOString())
      .order('created_at', { ascending: false })
      .limit(20000);

    if (error) throw error;
    return (data as PageViewRow[]).map(rowToPageView);
  },
};
