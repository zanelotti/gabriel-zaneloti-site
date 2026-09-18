import { useState } from 'react';
import type { Lead } from '@/types/lead';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/types/lead';
import { STATUS_STYLES } from './statusStyles';
import { LeadCard } from './LeadCard';
import { LeadDetailModal } from './LeadDetailModal';

interface BoardViewProps {
  leads: Lead[];
  onChange: () => void;
}

export function BoardView({ leads, onChange }: BoardViewProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const columns = LEAD_STATUS_ORDER.map((status) => ({
    status,
    leads: leads.filter((lead) => (lead.status ?? 'novo') === status),
  }));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {columns.map(({ status, leads: columnLeads }) => (
          <div key={status} className="flex min-w-0 flex-col">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${STATUS_STYLES[status].bg}`}>
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[status].dot}`} />
              <p className={`text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status].text}`}>
                {LEAD_STATUS_LABEL[status]}
              </p>
              <span className="ml-auto text-xs font-bold text-navy-400">{columnLeads.length}</span>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              {columnLeads.length === 0 && (
                <p className="rounded-xl border border-dashed border-navy-200 p-4 text-center text-xs text-navy-300">
                  Nenhum lead aqui
                </p>
              )}
              {columnLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
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
