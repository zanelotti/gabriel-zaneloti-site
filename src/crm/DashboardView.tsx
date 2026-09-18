import type { Lead } from '@/types/lead';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/types/lead';
import { BRAZILIAN_STATES } from '@/data/states';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { StatTile } from './charts/StatTile';
import { HorizontalBarChart, type HorizontalBarDatum } from './charts/HorizontalBarChart';
import { MonthlyColumnChart, type MonthlyDatum } from './charts/MonthlyColumnChart';
import { STATUS_STYLES } from './statusStyles';

interface DashboardViewProps {
  leads: Lead[];
}

const ESTADO_NOME = new Map(BRAZILIAN_STATES.map((s) => [s.uf, s.nome]));

function topEntries(counts: Map<string, number>, limit: number): [string, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function DashboardView({ leads }: DashboardViewProps) {
  const total = leads.length;
  const fechados = leads.filter((l) => (l.status ?? 'novo') === 'fechado');
  const perdidos = leads.filter((l) => (l.status ?? 'novo') === 'perdido');
  const emAndamento = total - fechados.length - perdidos.length;

  const taxaConversao = total > 0 ? (fechados.length / total) * 100 : 0;
  const valorTotalFechado = fechados.reduce((sum, l) => sum + (l.valorFechado ?? 0), 0);

  const agora = new Date();
  const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const leadsEsteMes = leads.filter((l) => new Date(l.createdAt) >= inicioDoMes).length;

  // Funil: contagem por etapa, na ordem definida.
  const funilData: HorizontalBarDatum[] = LEAD_STATUS_ORDER.map((status) => {
    const count = leads.filter((l) => (l.status ?? 'novo') === status).length;
    return {
      label: LEAD_STATUS_LABEL[status],
      value: count,
      colorClass: STATUS_STYLES[status].dot,
    };
  });

  // Leads por estado (top 8).
  const estadoCounts = new Map<string, number>();
  leads.forEach((l) => {
    if (!l.estado) return;
    estadoCounts.set(l.estado, (estadoCounts.get(l.estado) ?? 0) + 1);
  });
  const estadoData: HorizontalBarDatum[] = topEntries(estadoCounts, 8).map(([uf, count]) => ({
    label: ESTADO_NOME.get(uf) ?? uf,
    value: count,
    colorClass: 'bg-navy-400',
  }));

  // Leads por tipo de obra.
  const tipoCounts = new Map<string, number>();
  leads.forEach((l) => {
    if (!l.tipoObra) return;
    tipoCounts.set(l.tipoObra, (tipoCounts.get(l.tipoObra) ?? 0) + 1);
  });
  const tipoLabels: Record<string, string> = { alvenaria: 'Alvenaria', madeira: 'Madeira', mista: 'Mista' };
  const tipoData: HorizontalBarDatum[] = topEntries(tipoCounts, 5).map(([tipo, count]) => ({
    label: tipoLabels[tipo] ?? tipo,
    value: count,
    colorClass: 'bg-accent-500',
  }));

  // Leads por mês (últimos 6 meses, incluindo o atual).
  const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthFormatter.format(d).replace('.', '') });
  }
  const monthCounts = new Map(months.map((m) => [m.key, 0]));
  leads.forEach((l) => {
    const d = new Date(l.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  });
  const monthlyData: MonthlyDatum[] = months.map((m) => ({ label: m.label, value: monthCounts.get(m.key) ?? 0 }));

  if (total === 0) {
    return (
      <div className="rounded-xl2 border border-dashed border-navy-200 p-10 text-center text-navy-400">
        Ainda não há leads suficientes para mostrar o dashboard.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total de leads" value={String(total)} hint={`${leadsEsteMes} este mês`} />
        <StatTile label="Em andamento" value={String(emAndamento)} />
        <StatTile
          label="Taxa de conversão"
          value={formatPercent(taxaConversao)}
          hint={`${fechados.length} fechados de ${total}`}
          accent="accent"
        />
        <StatTile label="Valor fechado" value={formatCurrency(valorTotalFechado)} accent="accent" />
      </div>

      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Funil de conversão</h2>
        <div className="mt-4">
          <HorizontalBarChart data={funilData} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Leads por estado</h2>
          <div className="mt-4">
            <HorizontalBarChart data={estadoData} />
          </div>
        </div>

        <div className="card">
          <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Leads por tipo de obra</h2>
          <div className="mt-4">
            <HorizontalBarChart data={tipoData} />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-wide text-navy-500">Leads por mês</h2>
        <div className="mt-4">
          <MonthlyColumnChart data={monthlyData} />
        </div>
      </div>
    </div>
  );
}
