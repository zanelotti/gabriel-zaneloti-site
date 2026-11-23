import type { DragEvent } from 'react';
import type { Lead } from '@/types/lead';
import { formatCurrency } from '@/utils/formatters';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  /** Chamado quando o usuário começa a arrastar este card (drag-and-drop entre colunas). */
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  /** Chamado quando o arraste termina (com ou sem soltar num alvo válido). */
  onDragEnd: () => void;
  /** true enquanto este card específico está sendo arrastado — usado para reduzir sua opacidade. */
  isDragging: boolean;
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

export function LeadCard({ lead, onClick, onDragStart, onDragEnd, isDragging }: LeadCardProps) {
  const detalhes = [lead.estado, lead.tipoObra].filter(Boolean).join(' · ');

  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`w-full cursor-grab rounded-xl border border-navy-100 bg-white p-3 text-left shadow-soft transition-shadow hover:shadow-card active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-navy-900" title={lead.nome || 'Sem nome'}>
          {lead.nome || 'Sem nome'}
        </p>
        <span className="shrink-0 text-[11px] font-medium text-navy-400">{timeAgo(lead.createdAt)}</span>
      </div>

      <p className="mt-1 truncate text-xs text-navy-500" title={detalhes ? `${lead.whatsapp} · ${detalhes}` : lead.whatsapp}>
        <span>{lead.whatsapp || 'Sem WhatsApp'}</span>
        {detalhes && <span className="capitalize text-navy-400"> · {detalhes}</span>}
      </p>

      {lead.economiaEstimada !== null && (
        // Uma linha para cada valor: nas colunas estreitas do quadro os dois lado a lado se sobrepunham.
        <dl className="mt-2 space-y-0.5 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-navy-400">Economia</dt>
            <dd className="font-bold text-accent-600">{formatCurrency(lead.economiaEstimada)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-navy-400">Honorário</dt>
            <dd className="font-bold text-navy-700">{formatCurrency(lead.economiaEstimada * 0.12)}</dd>
          </div>
        </dl>
      )}
    </button>
  );
}
