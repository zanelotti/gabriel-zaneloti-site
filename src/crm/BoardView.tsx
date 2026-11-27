import { useEffect, useMemo, useState } from 'react';
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
 * Chave do localStorage usada para lembrar quais colunas o usuário deixou
 * recolhidas — preferência só deste navegador, não é sincronizada com o
 * Supabase nem aparece pra outra pessoa que acesse o CRM.
 */
const COLLAPSE_STORAGE_KEY = 'crm-board-colunas-recolhidas';

function loadCollapsedColumns(): Partial<Record<LeadStatus, boolean>> {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Tira acentos e deixa minúsculo, pra "joao" achar "João". */
function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Diz se o lead bate com o que foi digitado na pesquisa.
 * Nome: sem acento, qualquer parte do nome. Telefone: compara só os números,
 * então "99734", "(21) 99734" e "21997341731" acham o mesmo lead.
 */
function leadBateComPesquisa(lead: Lead, pesquisa: string): boolean {
  const termo = normalizarTexto(pesquisa);
  if (!termo) return true;
  if (normalizarTexto(lead.nome || '').includes(termo)) return true;
  const digitos = pesquisa.replace(/\D/g, '');
  if (digitos.length >= 3 && (lead.whatsapp || '').replace(/\D/g, '').includes(digitos)) return true;
  return false;
}

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
  // Colunas recolhidas (cards escondidos) — carregado do localStorage, pra
  // lembrar a preferência entre acessos neste mesmo navegador.
  const [collapsedColumns, setCollapsedColumns] = useState<Partial<Record<LeadStatus, boolean>>>(loadCollapsedColumns);
  const [pesquisa, setPesquisa] = useState('');
  const pesquisando = pesquisa.trim().length > 0;

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsedColumns));
    } catch {
      // Sem problema se o navegador bloquear localStorage (ex: aba anônima) — só não lembra a preferência.
    }
  }, [collapsedColumns]);

  const toggleColumn = (status: LeadStatus) => {
    setCollapsedColumns((prev) => ({ ...prev, [status]: !prev[status] }));
  };

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

  const leadsVisiveis = useMemo(
    () => (pesquisando ? leads.filter((lead) => leadBateComPesquisa(lead, pesquisa)) : leads),
    [leads, pesquisa, pesquisando],
  );

  const columns = LEAD_STATUS_ORDER.map((status) => ({
    status,
    leads: leadsVisiveis.filter((lead) => (pendingMoves[lead.id] ?? lead.status ?? 'novo') === status),
  }))
    // Pesquisando, só aparecem as colunas que têm resultado (os achados ficam juntos, sem rolar a tela).
    .filter((column) => !pesquisando || column.leads.length > 0);

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
      {/* Barra de pesquisa: acha o lead pelo nome ou pelo telefone, em todas as colunas. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-md">
          <span className="sr-only">Pesquisar lead</span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth={2} />
            <path d="M14 14l4 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            value={pesquisa}
            onChange={(event) => setPesquisa(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setPesquisa('');
            }}
            placeholder="Pesquisar por nome ou telefone"
            className="w-full rounded-full border border-navy-200 bg-white py-2.5 pl-10 pr-10 text-sm text-navy-900 shadow-soft placeholder:text-navy-400 focus:border-navy-400 focus:outline-none"
          />
          {pesquisando && (
            <button
              type="button"
              onClick={() => setPesquisa('')}
              aria-label="Limpar pesquisa"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-navy-400 hover:bg-navy-100 hover:text-navy-700"
            >
              ✕
            </button>
          )}
        </label>
        {pesquisando && (
          <p className="text-sm font-medium text-navy-500">
            {leadsVisiveis.length === 0
              ? 'Nenhum lead encontrado'
              : `${leadsVisiveis.length} lead${leadsVisiveis.length > 1 ? 's' : ''} encontrado${leadsVisiveis.length > 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Colunas largas lado a lado; se não couberem na tela, o quadro rola para o lado. */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map(({ status, leads: columnLeads }) => {
          // Pesquisando, as colunas recolhidas abrem sozinhas pra mostrar o que foi achado.
          const isCollapsed = Boolean(collapsedColumns[status]) && !pesquisando;
          return (
            <div
              key={status}
              className={`flex shrink-0 flex-col ${isCollapsed ? 'w-44' : 'w-[260px] min-w-[260px] max-w-[340px] flex-1'}`}
            >
              <button
                type="button"
                onClick={() => toggleColumn(status)}
                aria-expanded={!isCollapsed}
                className={`flex w-full items-center gap-2 rounded-full px-3 py-1 text-left transition-colors ${STATUS_STYLES[status].bg}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLES[status].dot}`} />
                <p className={`min-w-0 truncate text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[status].text}`}>
                  {LEAD_STATUS_LABEL[status]}
                </p>
                <span className="ml-auto shrink-0 text-xs font-bold text-navy-400">{columnLeads.length}</span>
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`h-3.5 w-3.5 shrink-0 transition-transform ${STATUS_STYLES[status].text} ${
                    isCollapsed ? '-rotate-90' : ''
                  }`}
                  aria-hidden="true"
                >
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

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
                {isCollapsed ? (
                  columnLeads.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleColumn(status)}
                      className="rounded-xl border border-dashed border-navy-200 p-3 text-center text-xs text-navy-400 hover:border-navy-300 hover:text-navy-600"
                    >
                      {columnLeads.length} lead{columnLeads.length > 1 ? 's' : ''} oculto
                      {columnLeads.length > 1 ? 's' : ''} — clique para mostrar
                    </button>
                  )
                ) : (
                  <>
                    {columnLeads.length === 0 && (
                      <p className="rounded-xl border border-dashed border-navy-200 p-3 text-center text-xs text-navy-300">
                        {pesquisando ? 'Nada aqui' : 'Nenhum lead aqui'}
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
                  </>
                )}
              </div>
            </div>
          );
        })}
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
