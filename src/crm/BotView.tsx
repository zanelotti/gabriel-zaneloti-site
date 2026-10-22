import { useCallback, useEffect, useState } from 'react';
import {
  botService,
  type BotConfig,
  type BotConversa,
  type BotHeartbeat,
  type BotMensagemResumo,
  type BotUso,
} from '@/services/botService';
import type { Lead } from '@/types/lead';
import { BotConfigView } from './bot/BotConfigView';
import { BotConhecimentoView } from './bot/BotConhecimentoView';
import { BotConversasView } from './bot/BotConversasView';
import { BotPainelView } from './bot/BotPainelView';

type SubTab = 'painel' | 'conversas' | 'config' | 'conhecimento';

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'painel', label: 'Painel' },
  { id: 'conversas', label: 'Conversas' },
  { id: 'config', label: 'Configurações' },
  { id: 'conhecimento', label: 'Conhecimento' },
];

/** Dias de histórico carregados para métricas e para o resumo da lista de conversas. */
const DIAS_HISTORICO = 90;

interface BotViewProps {
  leads: Lead[];
}

export function BotView({ leads }: BotViewProps) {
  const [sub, setSub] = useState<SubTab>('painel');
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [heartbeat, setHeartbeat] = useState<BotHeartbeat | null>(null);
  const [conversas, setConversas] = useState<BotConversa[]>([]);
  const [resumo, setResumo] = useState<BotMensagemResumo[]>([]);
  const [usos, setUsos] = useState<BotUso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados "vivos": status, configuração e lista de conversas (a cada 6 s).
  const loadLive = useCallback(async () => {
    try {
      const [cfg, hb, convs] = await Promise.all([
        botService.getConfig(),
        botService.getHeartbeat(),
        botService.listConversas(),
      ]);
      setConfig(cfg);
      setHeartbeat(hb);
      setConversas(convs);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — confira se você rodou o arquivo supabase_bot_painel.sql no Supabase.`
          : 'Falha ao carregar o painel do bot.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Dados pesados (histórico de mensagens e consumo): a cada 60 s.
  const loadHeavy = useCallback(async () => {
    try {
      const [msgs, consumo] = await Promise.all([
        botService.listMensagensResumo(DIAS_HISTORICO),
        botService.listUso(DIAS_HISTORICO),
      ]);
      setResumo(msgs);
      setUsos(consumo);
    } catch {
      // Se a tabela de consumo ainda não existir, o resto do painel continua funcionando.
    }
  }, []);

  useEffect(() => {
    void loadLive();
    void loadHeavy();
    const live = setInterval(() => void loadLive(), 6000);
    const heavy = setInterval(() => void loadHeavy(), 60000);
    return () => {
      clearInterval(live);
      clearInterval(heavy);
    };
  }, [loadLive, loadHeavy]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadLive(), loadHeavy()]);
  }, [loadLive, loadHeavy]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Bot de WhatsApp</h2>
          <p className="text-sm text-navy-500">Controle da assistente que conversa com os leads da calculadora.</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {SUBTABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                sub === t.id ? 'bg-accent-500 text-navy-950' : 'bg-white text-navy-500 hover:bg-navy-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && <p className="text-sm font-medium text-navy-400">Carregando o painel do bot…</p>}
      {error && <div className="mb-4 rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!loading && !error && sub === 'painel' && (
        <BotPainelView
          config={config}
          heartbeat={heartbeat}
          conversas={conversas}
          resumo={resumo}
          usos={usos}
          onChange={refreshAll}
        />
      )}
      {!loading && !error && sub === 'conversas' && (
        <BotConversasView leads={leads} conversas={conversas} resumo={resumo} onChange={refreshAll} />
      )}
      {!loading && !error && sub === 'config' && <BotConfigView config={config} onChange={refreshAll} />}
      {!loading && !error && sub === 'conhecimento' && <BotConhecimentoView />}
    </div>
  );
}
