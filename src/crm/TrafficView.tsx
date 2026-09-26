import type { PageView } from '@/services/crmService';
import { StatTile } from './charts/StatTile';
import { HorizontalBarChart, type HorizontalBarDatum } from './charts/HorizontalBarChart';
import { MonthlyColumnChart, type MonthlyDatum } from './charts/MonthlyColumnChart';

interface TrafficViewProps {
  pageViews: PageView[];
}

/** Rótulos legíveis pras páginas públicas do site (ver vite.config.ts para a lista completa de entradas). */
const PATH_LABELS: Record<string, string> = {
  '/': 'Página inicial',
  '/index.html': 'Página inicial',
  '/sobre.html': 'Sobre',
  '/privacidade.html': 'Política de privacidade',
  '/termos.html': 'Termos de uso',
};

function pathLabel(path: string): string {
  return PATH_LABELS[path] ?? path;
}

function topEntries(counts: Map<string, number>, limit: number): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

/** Agrupa um referrer completo (URL) pelo domínio de origem — mais legível que a URL inteira. */
function referrerOrigin(referrer: string | null): string {
  if (!referrer) return 'Direto / desconhecido';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return referrer;
  }
}

/**
 * Painel de tráfego do site público (aba "Tráfego" do CRM) — mesma lógica de
 * agregação em memória usada no DashboardView (os dados já vêm carregados do
 * Supabase, ver crmTrafficService.listPageViews). Cobre só os últimos 180
 * dias de visualizações.
 */
export function TrafficView({ pageViews }: TrafficViewProps) {
  const total = pageViews.length;

  if (total === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-navy-200 p-10 text-center text-navy-400">
        Ainda não há visitas suficientes para mostrar o tráfego. Assim que alguém visitar o site (ou se a tabela{' '}
        <code className="rounded bg-navy-100 px-1 py-0.5">page_views</code> ainda não existir no Supabase — rode o{' '}
        <code className="rounded bg-navy-100 px-1 py-0.5">supabase_setup.sql</code>), os dados aparecem aqui.
      </div>
    );
  }

  const visitorIds = new Set(pageViews.map((v) => v.visitorId).filter((id): id is string => Boolean(id)));
  const visitantesUnicos = visitorIds.size;

  const agora = new Date();
  const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioDaSemana = new Date(inicioDoDia);
  inicioDaSemana.setDate(inicioDaSemana.getDate() - 6);

  const viewsHoje = pageViews.filter((v) => new Date(v.createdAt) >= inicioDoDia).length;
  const viewsSemana = pageViews.filter((v) => new Date(v.createdAt) >= inicioDaSemana).length;

  // Páginas mais vistas.
  const pathCounts = new Map<string, number>();
  pageViews.forEach((v) => {
    pathCounts.set(v.path, (pathCounts.get(v.path) ?? 0) + 1);
  });
  const topPaths: HorizontalBarDatum[] = topEntries(pathCounts, 8).map(([path, count]) => ({
    label: pathLabel(path),
    value: count,
    colorClass: 'bg-navy-400',
  }));

  // De onde vêm os visitantes (domínio de origem do referrer).
  const referrerCounts = new Map<string, number>();
  pageViews.forEach((v) => {
    const origem = referrerOrigin(v.referrer);
    referrerCounts.set(origem, (referrerCounts.get(origem) ?? 0) + 1);
  });
  const topReferrers: HorizontalBarDatum[] = topEntries(referrerCounts, 8).map(([origem, count]) => ({
    label: origem,
    value: count,
    colorClass: 'bg-accent-500',
  }));

  // Visualizações por mês (últimos 6 meses, incluindo o atual).
  const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthFormatter.format(d).replace('.', '') });
  }
  const monthCounts = new Map(months.map((m) => [m.key, 0]));
  pageViews.forEach((v) => {
    const d = new Date(v.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  });
  const monthlyData: MonthlyDatum[] = months.map((m) => ({ label: m.label, value: monthCounts.get(m.key) ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Visualizações (180 dias)" value={String(total)} hint="Soma de todas as páginas" />
        <StatTile label="Visitantes únicos" value={String(visitantesUnicos)} accent="accent" />
        <StatTile label="Hoje" value={String(viewsHoje)} />
        <StatTile label="Últimos 7 dias" value={String(viewsSemana)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Páginas mais vistas</h2>
          <div className="mt-4">
            <HorizontalBarChart data={topPaths} />
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">De onde vêm os visitantes</h2>
          <div className="mt-4">
            <HorizontalBarChart data={topReferrers} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Visualizações por mês</h2>
        <div className="mt-4">
          <MonthlyColumnChart data={monthlyData} />
        </div>
      </div>

      <p className="text-xs text-navy-400">
        Dados guardados no seu próprio Supabase (tabela{' '}
        <code className="rounded bg-navy-50 px-1 py-0.5">page_views</code>) — só das páginas públicas do site (home,
        sobre, privacidade e termos). Não conta suas próprias visitas às ferramentas internas (calculadora interna e
        este CRM).
      </p>
    </div>
  );
}
