import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import type { Lead, LeadStatus } from '@/types/lead';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/types/lead';
import { crmLeadService } from '@/services/crmService';
import { STATUS_STYLES } from './statusStyles';
import { LeadCard } from './LeadCard';
import { LeadDetailModal } from './LeadDetailModal';

interface BoardViewProps {
  leads: Lead[];
  onChange: () => void;
}

/** Formato "text/plain" usado pelo dataTransfer para identificar o lead sendo arrastado. */
const DRAG_MIME_TYPE = 'text/plain';

/**
 * Quadro estilo Trello: cada lead é arrastável (Drag and Drop nativo do
 * navegador, sem depender de nenhuma biblioteca externa) entre as colunas do
 * funil. Ao soltar num lead numa coluna diferente, grava o novo status no
 * Supabase e atualiza a lista.
 */
export function BoardView({ leads, onChange }: BoardViewProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);
  // Move otimista: assim que o lead é solto numa coluna, ele já aparece lá
  // visualmente enquanto a gravação no banco acontece em segundo plano.
  const [pendingMoves, setPendingMoves] = useState<Record<string, LeadStatus>>({});

  // Limpa os moves otimistas assim que os dados "de verdade" (vindos do
  // Supabase, via onChange) confirmam a mudança — ou se o lead sumiu da lista.
  useEffect(() => {
    setPendingMoves((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [leadId, status] of Object.entries(prev)) {
        const lead = leads.find((item) => item.id === leadId);
        if (!lead || (lead.status ?? 'novo') === status) {
          delete next[leadId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [leads]);

  const columns = LEAD_STATUS_ORDER.map((status) => ({
    status,
    leads: leads.filter((lead) => (pendingMoves[lead.id] ?? lead.status ?? 'novo') === status),
  }));

  const handleDragStart = (lead: Lead) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_MIME_TYPE, lead.id);
    setDraggingLeadId(lead.id);
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDragOverStatus(null);
  };

  const handleDragOverColumn = (status: LeadStatus) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDropOnColumn = (status: LeadStatus) => async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverStatus(null);
    const leadId = event.dataTransfer.getData(DRAG_MIME_TYPE) || draggingLeadId;
    setDraggingLeadId(null);
    if (!leadId) return;

    const lead = leads.find((item) => item.id === leadId);
    if (!lead || (lead.status ?? 'novo') === status) return;

    setPendingMoves((prev) => ({ ...prev, [leadId]: status }));
    try {
      await crmLeadService.updateStatus(leadId, status);
      onChange();
    } catch {
      setPendingMoves((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
      alert('Não foi possível mover o lead para essa etapa. Tente novamente.');
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {columns.map(({ status, leads: columnLeads }) => (
          <div key={status} className="flex min-w-0 flex-col">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${STATUS_STYLES[status].bg}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLES[status].dot}`} />
              <p className={`truncate text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status].text}`}>
                {LEAD_STATUS_LABEL[status]}
              </p>
              <span className="ml-auto shrink-0 text-xs font-bold text-navy-400">{columnLeads.length}</span>
            </div>

            <div
              onDragOver={handleDragOverColumn(status)}
              onDragLeave={(event) => {
                // Só limpa o destaque quando o cursor realmente sai da coluna
                // (não a cada vez que passa de um card filho para outro).
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverStatus((current) => (current === status ? null : current));
                }
              }}
              onDrop={handleDropOnColumn(status)}
              className={`mt-2 flex min-h-[60px] flex-1 flex-col gap-2 rounded-xl transition-colors ${
                dragOverStatus === status ? 'bg-navy-100/70 ring-2 ring-navy-300 ring-inset' : ''
              }`}
            >
              {columnLeads.length === 0 && (
                <p className="rounded-xl border border-dashed border-navy-200 p-3 text-center text-xs text-navy-300">
                  Nenhum lead aqui
                </p>
              )}
              {columnLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={() => setSelectedLead(lead)}
                  onDragStart={handleDragStart(lead)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingLeadId === lead.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onChange={() => {
            onChange();
            setSelectedLead(null);
          }}
        />
      )}
    </>
  );
}
