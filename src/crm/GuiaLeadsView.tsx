import { useState } from 'react';
import type { GuiaLead } from '@/types/lead';
import { crmGuiaLeadService } from '@/services/crmService';

interface GuiaLeadsViewProps {
  guiaLeads: GuiaLead[];
  onChange: () => void;
}

/** Formata um timestamp ISO completo (ex: "2026-09-23T14:05:00Z") como "23/09/2026 14:05". */
function formatDateTimeBR(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Escapa um campo pra uso seguro dentro de uma linha CSV (aspas duplas + separador vírgula). */
function csvEscape(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

/** Gera o CSV (nome, e-mail, whatsapp, data) e dispara o download no navegador. */
function downloadCsv(guiaLeads: GuiaLead[]): void {
  const header = ['Nome', 'E-mail', 'WhatsApp', 'Baixado em'];
  const rows = guiaLeads.map((lead) => [
    lead.nome,
    lead.email,
    lead.whatsapp,
    formatDateTimeBR(lead.createdAt),
  ]);

  // ﻿ (BOM) no início garante que o Excel abra os acentos corretamente.
  const csvContent =
    '﻿' + [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `guia-leads-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Lista, em formato de planilha, todos os contatos que baixaram o guia
 * gratuito em PDF (nome + e-mail + WhatsApp) — pensada especificamente pra
 * exportar em CSV e subir numa campanha de remarketing (Meta Ads / Google
 * Ads Custom Audiences), como pedido pelo Gabriel.
 */
export function GuiaLeadsView({ guiaLeads, onChange }: GuiaLeadsViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (lead: GuiaLead) => {
    if (!confirm(`Remover "${lead.nome || 'este contato'}" da lista?`)) return;
    setDeletingId(lead.id);
    try {
      await crmGuiaLeadService.deleteGuiaLead(lead.id);
      onChange();
    } catch {
      alert('Não foi possível remover este contato. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Contatos do guia gratuito</h2>
          <p className="text-xs font-medium text-navy-400">
            {guiaLeads.length} {guiaLeads.length === 1 ? 'contato' : 'contatos'} · nome, e-mail e WhatsApp de quem
            baixou o PDF
          </p>
        </div>

        <button
          onClick={() => downloadCsv(guiaLeads)}
          disabled={guiaLeads.length === 0}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Baixar CSV
        </button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-navy-100 bg-white">
        {guiaLeads.length === 0 ? (
          <p className="p-6 text-center text-sm text-navy-400">
            Ninguém baixou o guia ainda. Assim que alguém preencher o formulário no site, o contato aparece aqui.
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-xs font-bold uppercase tracking-wide text-navy-400">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">WhatsApp</th>
                <th className="px-4 py-3">Baixado em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {guiaLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-navy-100 last:border-0">
                  <td className="px-4 py-3 font-semibold text-navy-900">{lead.nome || '—'}</td>
                  <td className="px-4 py-3 text-navy-700">{lead.email || '—'}</td>
                  <td className="px-4 py-3 text-navy-700">{lead.whatsapp || '—'}</td>
                  <td className="px-4 py-3 text-navy-400">{formatDateTimeBR(lead.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(lead)}
                      disabled={deletingId === lead.id}
                      className="text-xs font-semibold text-navy-300 hover:text-red-600 disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
