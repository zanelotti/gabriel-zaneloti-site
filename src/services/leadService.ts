import type { Lead, NewLeadInput } from '@/types/lead';
import type { CalculatorData, INSSResult } from '@/types/calculator';

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

/**
 * Avisa o Gabriel por e-mail (via função serverless `/api/notify-lead`) toda
 * vez que uma simulação é concluída. É só um "extra" sobre a captura do
 * lead — nunca deve impedir nem atrasar o fluxo de quem está simulando, por
 * isso roda em paralelo (fire-and-forget) e engole qualquer erro/timeout.
 */
function notifyByEmail(lead: Lead): void {
  if (typeof fetch === 'undefined') return;
  fetch('/api/notify-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead),
  }).catch(() => {
    // Falha de rede, função ainda não configurada etc. — não é responsabilidade
    // do visitante do site, e não deve gerar nenhum erro visível para ele.
  });
}

/**
 * Avisa o Gabriel por e-mail quando um lead baixa o PDF de diagnóstico do
 * resultado — um segundo sinal de interesse, mais forte que só simular. Não
 * grava um novo registro (o lead já existe desde o fim da simulação, via
 * `createLead`) — é só uma notificação extra, com o WhatsApp do cliente já
 * preenchido e um roteiro de próximos passos pro Gabriel. Fire-and-forget,
 * mesmo padrão de `notifyByEmail`: nunca deve atrapalhar o download do PDF
 * em si.
 */
function notifyPdfDownload(data: CalculatorData, result: INSSResult): void {
  if (typeof fetch === 'undefined') return;
  const payload = {
    ...data,
    ...result,
    evento: 'pdf_baixado',
    createdAt: new Date().toISOString(),
  };
  fetch('/api/notify-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Mesma lógica do notifyByEmail: falha de rede etc. não deve gerar
    // nenhum erro visível pro visitante, que já conseguiu baixar o PDF.
  });
}

export const leadService = {
  /** Cria e persiste um novo lead a partir dos dados da simulação + resultado. */
  async createLead(input: NewLeadInput): Promise<Lead> {
    const lead = await activeAdapter.create(input);
    notifyByEmail(lead);
    return lead;
  },

  /** Lista os leads já armazenados (útil para depuração/administração local). */
  async listLeads(): Promise<Lead[]> {
    return activeAdapter.list();
  },

  notifyPdfDownload,
};
