import { useEffect, useState } from 'react';
import { crmAuth, crmGuiaLeadService, crmLeadService, crmTrafficService } from '@/services/crmService';
import type { PageView } from '@/services/crmService';
import type { GuiaLead, Lead } from '@/types/lead';
import { BoardView } from './BoardView';
import { DashboardView } from './DashboardView';
import { GuiaLeadsView } from './GuiaLeadsView';
import { TrafficView } from './TrafficView';

type Tab = 'quadro' | 'dashboard' | 'guia' | 'trafego';

export function MainShell() {
  const [tab, setTab] = useState<Tab>('quadro');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [guiaLeads, setGuiaLeads] = useState<GuiaLead[]>([]);
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [leadsData, guiaLeadsData] = await Promise.all([
        crmLeadService.listLeads(),
        crmGuiaLeadService.listGuiaLeads(),
      ]);
      setLeads(leadsData);
      setGuiaLeads(guiaLeadsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar os leads.');
    } finally {
      setLoading(false);
    }

    // Tráfego é carregado à parte: se a tabela `page_views` ainda não existir
    // no Supabase (supabase_setup.sql não rodado ainda), isso não deve travar
    // o resto do CRM (quadro, dashboard, guia).
    try {
      const pageViewsData = await crmTrafficService.listPageViews();
      setPageViews(pageViewsData);
    } catch {
      setPageViews([]);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="sticky top-0 z-10 border-b border-navy-100 bg-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-navy-900">CRM — Gabriel Zaneloti</h1>
            <p className="text-xs font-medium text-navy-400">{leads.length} leads no total</p>
          </div>

          <nav className="flex items-center gap-2">
            <button
              onClick={() => setTab('quadro')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'quadro' ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-100'
              }`}
            >
              Quadro
            </button>
            <button
              onClick={() => setTab('dashboard')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'dashboard' ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-100'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setTab('guia')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'guia' ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-100'
              }`}
            >
              Guia
            </button>
            <button
              onClick={() => setTab('trafego')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === 'trafego' ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-100'
              }`}
            >
              Tráfego
            </button>
            <button
              onClick={() => crmAuth.signOut()}
              className="ml-2 rounded-full px-4 py-2 text-sm font-semibold text-navy-400 hover:bg-navy-100"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="container-page py-8">
        {loading && <p className="text-sm font-medium text-navy-400">Carregando leads…</p>}

        {error && (
          <div className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && tab === 'quadro' && <BoardView leads={leads} onChange={reload} />}
        {!loading && !error && tab === 'dashboard' && <DashboardView leads={leads} />}
        {!loading && !error && tab === 'guia' && <GuiaLeadsView guiaLeads={guiaLeads} onChange={reload} />}
        {!loading && !error && tab === 'trafego' && <TrafficView pageViews={pageViews} />}
      </main>
    </div>
  );
}
