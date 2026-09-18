import type { Lead } from '@/types/lead';
import { formatCurrency } from '@/utils/formatters';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  if (diffDays < 30) return `há ${diffDays} dias`;
  const diffMonths = Math.floor(diffDays / 30);
  return diffMonths === 1 ? 'há 1 mês' : `há ${diffMonths} meses`;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-navy-100 bg-white p-4 text-left shadow-soft transition-shadow hover:shadow-card"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-navy-900">{lead.nome || 'Sem nome'}</p>
        <span className="shrink-0 text-xs font-medium text-navy-400">{timeAgo(lead.createdAt)}</span>
      </div>
      <p className="mt-0.5 text-sm text-navy-500">{lead.whatsapp || 'Sem WhatsApp'}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-400">
        {lead.estado && <span>{lead.estado}</span>}
        {lead.tipoObra && <span className="capitalize">{lead.tipoObra}</span>}
      </div>

      {lead.economiaEstimada !== null && (
        <p className="mt-2 text-sm font-bold text-accent-600">
          {formatCurrency(lead.economiaEstimada)} <span className="font-medium text-navy-400">estimado</span>
        </p>
      )}
    </button>
  );
}
