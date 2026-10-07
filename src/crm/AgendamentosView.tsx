import { useMemo, useState } from 'react';
import {
  AGENDAMENTO_STATUS_LABEL,
  AGENDAMENTO_STATUS_ORDER,
  type Agendamento,
  type AgendamentoStatus,
} from '@/types/lead';
import { crmAgendamentoService } from '@/services/crmService';
import { maskWhatsApp } from '@/utils/formatters';

interface AgendamentosViewProps {
  agendamentos: Agendamento[];
  onChange: () => void;
}

const FUSO = 'America/Sao_Paulo';

function formatDateTimeBR(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleString('pt-BR', {
    timeZone: FUSO,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2026-10-08 10:30:00-03:00" — formato que o Google Ads aceita na importação de conversões. */
function formatGoogleAdsTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}-03:00`;
}

function csvEscape(value: string): string {
  const needsQuotes = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, header: string[], rows: string[][]): void {
  // BOM no início garante que o Excel abra os acentos corretamente.
  const csvContent = '\uFEFF' + [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function splitNome(nome: string): { first: string; last: string } {
  const [first = '', ...rest] = nome.trim().split(/\s+/);
  return { first, last: rest.join(' ') };
}

function hasClickId(a: Agendamento): boolean {
  return Boolean(a.gclid || a.gbraid || a.wbraid);
}

function origemLabel(a: Agendamento): string {
  if (hasClickId(a)) return a.utmCampaign ? `Google Ads · ${a.utmCampaign}` : 'Google Ads';
  if (a.utmSource) return a.utmCampaign ? `${a.utmSource} · ${a.utmCampaign}` : a.utmSource;
  return 'Direto / orgânico';
}

/**
 * Lista das consultorias gratuitas agendadas pelo site, com status editável e
 * dois arquivos CSV prontos para o Google Ads:
 *   1. Público (Customer Match): e-mail + telefone de quem agendou, para
 *      criar uma lista de público e segmentar/excluir em campanhas;
 *   2. Conversões offline: o clique (gclid) que gerou cada agendamento, para
 *      "ensinar" o Google Ads quais cliques viram consultoria.
 */
export function AgendamentosView({ agendamentos, onChange }: AgendamentosViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [conversionName, setConversionName] = useState('Consultoria agendada');
  const [conversionKind, setConversionKind] = useState<'agendada' | 'realizada'>('agendada');

  const ordenados = useMemo(() => {
    const now = Date.now();
    const proximos = agendamentos
      .filter((a) => a.status === 'agendado' && new Date(a.fim).getTime() >= now)
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
    const demais = agendamentos
      .filter((a) => !proximos.includes(a))
      .sort((a, b) => b.inicio.localeCompare(a.inicio));
    return { proximos, demais, todos: [...proximos, ...demais] };
  }, [agendamentos]);

  const ativos = agendamentos.filter((a) => a.status !== 'cancelado');
  const comClique = ativos.filter(hasClickId);
  const today = new Date().toISOString().slice(0, 10);

  const handleStatus = async (item: Agendamento, status: AgendamentoStatus) => {
    setBusyId(item.id);
    try {
      await crmAgendamentoService.updateStatus(item.id, status);
      onChange();
    } catch {
      alert('Não foi possível atualizar o status. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: Agendamento) => {
    if (!confirm(`Remover o agendamento de "${item.nome || 'este contato'}"?`)) return;
    setBusyId(item.id);
    try {
      await crmAgendamentoService.deleteAgendamento(item.id);
      onChange();
    } catch {
      alert('Não foi possível remover este agendamento. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const exportAudience = () => {
    const seen = new Set<string>();
    const rows: string[][] = [];
    for (const a of ativos) {
      const key = a.email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const { first, last } = splitNome(a.nome);
      rows.push([a.email.toLowerCase(), a.whatsapp ? `+55${a.whatsapp}` : '', first, last, 'BR', '']);
    }
    downloadCsv(`google-ads-publico-agendamentos-${today}.csv`, ['Email', 'Phone', 'First Name', 'Last Name', 'Country', 'Zip'], rows);
  };

  const exportConversions = () => {
    const base = ativos.filter(hasClickId).filter((a) => (conversionKind === 'realizada' ? a.status === 'realizado' : true));
    const rows = base.map((a) => [
      a.gclid ?? '',
      a.gclid ? '' : a.gbraid ?? '',
      a.gclid || a.gbraid ? '' : a.wbraid ?? '',
      conversionName.trim() || 'Consultoria agendada',
      formatGoogleAdsTime(conversionKind === 'realizada' ? a.inicio : a.createdAt),
      '',
      'BRL',
    ]);
    downloadCsv(
      `google-ads-conversoes-${conversionKind}-${today}.csv`,
      ['Google Click ID', 'GBRAID', 'WBRAID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency'],
      rows
    );
  };

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-navy-900">Consultorias agendadas</h2>
        <p className="text-xs font-medium text-navy-400">
          {ordenados.proximos.length} {ordenados.proximos.length === 1 ? 'próxima' : 'próximas'} · {agendamentos.length}{' '}
          no total · {comClique.length} com clique do Google Ads rastreado
        </p>
      </div>

      <div className="mt-5 rounded-xl2 border border-navy-100 bg-white p-5">
        <h3 className="text-sm font-bold text-navy-900">Usar no Google Ads</h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-navy-100 p-4">
            <p className="text-sm font-semibold text-navy-900">1. Público (lista de clientes)</p>
            <p className="mt-1 text-xs text-navy-500">
              E-mail e telefone de todos que agendaram (sem os cancelados). No Google Ads: Ferramentas → Gerenciador de
              públicos → Nova lista → Lista de clientes (Customer Match).
            </p>
            <button
              onClick={exportAudience}
              disabled={ativos.length === 0}
              className="btn-primary mt-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Baixar público (CSV)
            </button>
          </div>

          <div className="rounded-xl border border-navy-100 p-4">
            <p className="text-sm font-semibold text-navy-900">2. Conversões offline (cliques que viraram consultoria)</p>
            <p className="mt-1 text-xs text-navy-500">
              Só entram agendamentos que vieram de clique rastreado. No Google Ads: Metas → Conversões → Enviar →
              Importação de cliques. O nome abaixo precisa ser igual ao da ação de conversão criada lá.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={conversionKind}
                onChange={(e) => {
                  const kind = e.target.value as 'agendada' | 'realizada';
                  setConversionKind(kind);
                  setConversionName(kind === 'realizada' ? 'Consultoria realizada' : 'Consultoria agendada');
                }}
                className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-800"
                aria-label="Tipo de conversão"
              >
                <option value="agendada">Agendadas</option>
                <option value="realizada">Realizadas (status "Realizado")</option>
              </select>
              <input
                value={conversionName}
                onChange={(e) => setConversionName(e.target.value)}
                className="min-w-[10rem] flex-1 rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-800"
                aria-label="Nome da ação de conversão"
              />
              <button
                onClick={exportConversions}
                disabled={comClique.length === 0}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Baixar conversões (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-navy-100 bg-white">
        {agendamentos.length === 0 ? (
          <p className="p-6 text-center text-sm text-navy-400">
            Nenhuma consultoria agendada ainda. Quando alguém agendar pelo site, aparece aqui (e no seu Google Agenda).
          </p>
        ) : (
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-xs font-bold uppercase tracking-wide text-navy-400">
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Sobre a obra</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ordenados.todos.map((a) => (
                <tr key={a.id} className="border-b border-navy-100 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-navy-900">
                    {formatDateTimeBR(a.inicio)}
                    {ordenados.proximos.includes(a) && (
                      <span className="ml-2 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase text-accent-800">
                        próxima
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-navy-900">{a.nome || '—'}</td>
                  <td className="px-4 py-3 text-navy-700">
                    <a
                      href={`https://wa.me/55${a.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-accent-700 hover:underline"
                    >
                      {maskWhatsApp(a.whatsapp) || '—'}
                    </a>
                    <div className="text-xs text-navy-400">{a.email || '—'}</div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3 text-xs text-navy-600">{a.observacoes || '—'}</td>
                  <td className="px-4 py-3 text-xs text-navy-600">{origemLabel(a)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={a.status}
                      disabled={busyId === a.id}
                      onChange={(e) => handleStatus(a, e.target.value as AgendamentoStatus)}
                      className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-xs font-semibold text-navy-800 disabled:opacity-50"
                      aria-label={`Status de ${a.nome}`}
                    >
                      {AGENDAMENTO_STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {AGENDAMENTO_STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={busyId === a.id}
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
