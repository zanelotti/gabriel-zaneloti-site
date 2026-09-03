import type { Lead, NewLeadInput } from '@/types/lead';

/**
 * ============================================================================
 *  CAMADA DE PERSISTÊNCIA DE LEADS
 * ============================================================================
 * Nenhum componente React deve falar diretamente com um banco de dados ou API.
 * Toda a captura de leads passa por este serviço (`leadService`), que expõe
 * uma interface estável independente de onde os leads são armazenados.
 *
 * Hoje: adaptador local (localStorage), usado como fallback enquanto não há
 * backend configurado no ambiente.
 *
 * Para conectar um backend real, implemente a interface `LeadStorageAdapter`
 * (ex: SupabaseLeadAdapter, ApiLeadAdapter, WebhookLeadAdapter) e troque a
 * instância exportada em `leadService` — nenhum componente precisa mudar.
 * ============================================================================
 */

const STORAGE_KEY = 'gz_leads';

export interface LeadStorageAdapter {
  create(input: NewLeadInput): Promise<Lead>;
  list(): Promise<Lead[]>;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Adaptador local baseado em localStorage.
 * Serve como placeholder funcional até a conexão com um backend real
 * (Supabase, API própria, CRM ou webhook).
 */
class LocalStorageLeadAdapter implements LeadStorageAdapter {
  private readSafely(): Lead[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Lead[]) : [];
    } catch {
      return [];
    }
  }

  private writeSafely(leads: Lead[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
    } catch {
      // Armazenamento indisponível (modo privado, quota excedida etc.) — falha silenciosamente,
      // já que a persistência local é apenas um fallback provisório.
    }
  }

  async create(input: NewLeadInput): Promise<Lead> {
    const lead: Lead = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    const leads = this.readSafely();
    leads.push(lead);
    this.writeSafely(leads);

    return lead;
  }

  async list(): Promise<Lead[]> {
    return this.readSafely();
  }
}

/**
 * Exemplo de esqueleto para uma futura integração via webhook/API própria.
 * Basta implementar `create`/`list` fazendo fetch() para o endpoint desejado
 * e trocar o adaptador ativo abaixo — mantido aqui apenas como referência,
 * sem URL fictícia configurada.
 */
// class WebhookLeadAdapter implements LeadStorageAdapter {
//   constructor(private readonly webhookUrl: string) {}
//   async create(input: NewLeadInput): Promise<Lead> {
//     const response = await fetch(this.webhookUrl, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(input),
//     });
//     if (!response.ok) throw new Error('Falha ao registrar lead no webhook.');
//     return response.json();
//   }
//   async list(): Promise<Lead[]> {
//     throw new Error('Listagem não suportada neste adaptador.');
//   }
// }

const activeAdapter: LeadStorageAdapter = new LocalStorageLeadAdapter();

export const leadService = {
  /** Cria e persiste um novo lead a partir dos dados da simulação + resultado. */
  async createLead(input: NewLeadInput): Promise<Lead> {
    return activeAdapter.create(input);
  },

  /** Lista os leads já armazenados (útil para depuração/administração local). */
  async listLeads(): Promise<Lead[]> {
    return activeAdapter.list();
  },
};
