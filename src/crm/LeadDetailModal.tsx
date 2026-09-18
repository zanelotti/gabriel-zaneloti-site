import { useState } from 'react';
import type { Lead, LeadStatus } from '@/types/lead';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER } from '@/types/lead';
import { crmLeadService } from '@/services/crmService';
import { formatArea, formatCurrency, formatDateBR } from '@/utils/formatters';
import { STATUS_STYLES } from './statusStyles';

interface LeadDetailModalProps {
  lead: Lead;
  onClose: () => void;
  onChange: () => void;
}

export function LeadDetailModal({ lead, onClose, onChange }: LeadDetailModalProps) {
  const [status, setStatus] = useState<LeadStatus>(lead.status ?? 'novo');
  const [notas, setNotas] = useState(lead.notas ?? '');
  const [valorFechado, setValorFechado] = useState(lead.valorFechado?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const tasks: Promise<void>[] = [];
      if (status !== (lead.status ?? 'novo')) tasks.push(crmLeadService.updateStatus(lead.id, status));
      if (notas !== (lead.notas ?? '')) tasks.push(crmLeadService.updateNotas(lead.id, notas));

      const trimmedValor = valorFechado.trim();
      let parsedValor: number | null = null;
      if (trimmedValor !== '') {
        const numeric = Number(trimmedValor.replace(',', '.'));
        parsedValor = Number.isNaN(numeric) ? null : numeric;
      }
      if (parsedValor !== (lead.valorFechado ?? null)) {
        tasks.push(crmLeadService.updateValorFechado(lead.id, parsedValor));
      }

      await Promise.all(tasks);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir o lead de "${lead.nome || 'sem nome'}"? Essa ação não pode ser desfeita.`)) return;
    setSaving(true);
    try {
      await crmLeadService.deleteLead(lead.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir o lead.');
      setSaving(false);
    }
  };

  const whatsappDigits = lead.whatsapp.replace(/\D/g, '');
  const whatsappLink = whatsappDigits ? `https://wa.me/55${whatsappDigits}` : null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-navy-950/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl2 bg-white p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-navy-900">{lead.nome || 'Sem nome'}</h2>
            <p className="text-sm text-navy-500">{lead.whatsapp || 'Sem WhatsApp'}</p>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        </div>

        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn-secondary mt-4 w-full">
            Chamar no WhatsApp
          </a>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-navy-50 p-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-navy-400">Estado</p>
            <p className="font-medium text-navy-800">{lead.estado || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-navy-400">Tipo de obra</p>
            <p className="font-medium capitalize text-navy-800">{lead.tipoObra || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-navy-400">Área principal</p>
            <p className="font-medium text-navy-800">{formatArea(lead.areaPrincipal)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-navy-400">Início da obra</p>
            <p className="font-medium text-navy-800">{formatDateBR(lead.dataInicio)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-navy-400">Economia estimada</p>
            <p className="font-medium text-accent-700">
              {lead.economiaEstimada !== null ? formatCurrency(lead.economiaEstimada) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-navy-400">Recebido em</p>
            <p className="font-medium text-navy-800">
              {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {lead.observacoes && (
          <div className="mt-4">
            <p className="field-label">Observações do formulário</p>
            <p className="rounded-xl bg-navy-50 p-3 text-sm text-navy-700">{lead.observacoes}</p>
          </div>
        )}

        <div className="mt-5">
          <p className="field-label">Etapa do funil</p>
          <div className="flex flex-wrap gap-2">
            {LEAD_STATUS_ORDER.map((option) => (
              <button
                key={option}
                onClick={() => setStatus(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  status === option
                    ? `${STATUS_STYLES[option].bg} ${STATUS_STYLES[option].text} ring-2 ring-navy-900`
                    : 'bg-navy-50 text-navy-400 hover:bg-navy-100'
                }`}
              >
                {LEAD_STATUS_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        {status === 'fechado' && (
          <div className="mt-4">
            <label className="field-label">Valor fechado (R$)</label>
            <input
              type="number"
              step="0.01"
              className="field-input"
              placeholder="0,00"
              value={valorFechado}
              onChange={(event) => setValorFechado(event.target.value)}
            />
          </div>
        )}

        <div className="mt-4">
          <label className="field-label">Anotações</label>
          <textarea
            className="field-input min-h-24 resize-y"
            placeholder="Ex: falei no WhatsApp dia 12, vai decidir até sexta…"
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-sm font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            Excluir lead
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline" disabled={saving}>
              Cancelar
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
