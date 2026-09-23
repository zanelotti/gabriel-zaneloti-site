import { useState } from 'react';
import type { Lead, LeadStatus } from '@/types/lead';
import { LEAD_STATUS_LABEL, LEAD_STATUS_ORDER, SDR_ESTADO_LABEL } from '@/types/lead';
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
  const [honorarios, setHonorarios] = useState(lead.honorarios?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdrSaving, setSdrSaving] = useState(false);
  const [sdrError, setSdrError] = useState<string | null>(null);

  const parseValor = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const numeric = Number(trimmed.replace(',', '.'));
    return Number.isNaN(numeric) ? null : numeric;
  };

  const valorFechadoNumerico = parseValor(valorFechado);
  const honorariosSugeridos =
    valorFechadoNumerico !== null ? Math.round(valorFechadoNumerico * 0.12 * 100) / 100 : null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const tasks: Promise<void>[] = [];
      if (status !== (lead.status ?? 'novo')) tasks.push(crmLeadService.updateStatus(lead.id, status));
      if (notas !== (lead.notas ?? '')) tasks.push(crmLeadService.updateNotas(lead.id, notas));

      const parsedValor = parseValor(valorFechado);
      if (parsedValor !== (lead.valorFechado ?? null)) {
        tasks.push(crmLeadService.updateValorFechado(lead.id, parsedValor));
      }

      const parsedHonorarios = parseValor(honorarios);
      if (parsedHonorarios !== (lead.honorarios ?? null)) {
        tasks.push(crmLeadService.updateHonorarios(lead.id, parsedHonorarios));
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

  const sdrVisivel = Boolean(lead.sdrAtivo) || (lead.sdrHistorico?.length ?? 0) > 0;

  const handleRetomarSdr = async () => {
    setSdrSaving(true);
    setSdrError(null);
    try {
      await crmLeadService.retomarSdrPosHonorarios(lead.id);
      onChange();
    } catch (err) {
      setSdrError(err instanceof Error ? err.message : 'Falha ao retomar o SDR.');
    } finally {
      setSdrSaving(false);
    }
  };

  const handleTogglePausarSdr = async () => {
    setSdrSaving(true);
    setSdrError(null);
    try {
      await crmLeadService.setSdrAtivo(lead.id, !lead.sdrAtivo, lead.sdrAtivo ? 'pausado' : undefined);
      onChange();
    } catch (err) {
      setSdrError(err instanceof Error ? err.message : 'Falha ao atualizar o SDR.');
    } finally {
      setSdrSaving(false);
    }
  };

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

        {sdrVisivel && (
          <div className="mt-5 rounded-xl border border-accent-300/50 bg-accent-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-accent-700">SDR automatizado (piloto)</p>
                <p className="mt-0.5 text-sm font-medium text-navy-800">
                  {lead.sdrAtivo ? 'Ativo' : 'Pausado'}
                  {lead.sdrEstado ? ` — ${SDR_ESTADO_LABEL[lead.sdrEstado]}` : ''}
                </p>
                {lead.sdrProximoContato && (
                  <p className="mt-0.5 text-xs text-navy-500">
                    Próximo follow-up: {formatDateBR(lead.sdrProximoContato)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleTogglePausarSdr}
                disabled={sdrSaving}
                className="btn-outline shrink-0 text-xs disabled:opacity-50"
              >
                {lead.sdrAtivo ? 'Pausar SDR' : 'Reativar SDR'}
              </button>
            </div>

            {lead.sdrEstado === 'aguardando_gabriel' && (
              <button
                type="button"
                onClick={handleRetomarSdr}
                disabled={sdrSaving}
                className="btn-primary mt-3 w-full text-sm disabled:opacity-50"
              >
                {sdrSaving ? 'Retomando…' : 'Já informei os honorários — retomar SDR'}
              </button>
            )}

            {sdrError && <p className="field-error mt-2">{sdrError}</p>}

            {lead.sdrHistorico && lead.sdrHistorico.length > 0 && (
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-white/70 p-3">
                {lead.sdrHistorico.map((entry, index) => (
                  <div key={index} className="text-xs">
                    <span
                      className={`font-semibold ${
                        entry.de === 'lead'
                          ? 'text-navy-700'
                          : entry.de === 'gabriel'
                            ? 'text-amber-700'
                            : entry.de === 'sistema'
                              ? 'text-navy-400'
                              : 'text-accent-700'
                      }`}
                    >
                      {entry.de === 'bot' ? 'SDR' : entry.de === 'lead' ? lead.nome || 'Lead' : entry.de === 'gabriel' ? 'Gabriel' : 'Sistema'}
                    </span>{' '}
                    <span className="text-navy-400">
                      {new Date(entry.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p className="text-navy-700">{entry.texto}</p>
                  </div>
                ))}
              </div>
            )}
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
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
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
            <div>
              <label className="field-label">Meus honorários (R$)</label>
              <input
                type="number"
                step="0.01"
                className="field-input"
                placeholder="0,00"
                value={honorarios}
                onChange={(event) => setHonorarios(event.target.value)}
              />
              {honorariosSugeridos !== null && (
                <button
                  type="button"
                  onClick={() => setHonorarios(honorariosSugeridos.toString())}
                  className="mt-1.5 text-xs font-medium text-accent-700 hover:underline"
                >
                  Usar sugestão (12%): {formatCurrency(honorariosSugeridos)}
                </button>
              )}
            </div>
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
