import { useMemo, useState } from 'react';
import type { BotConfig, BotConversa, BotHeartbeat, BotMensagemResumo, BotUso } from '@/services/botService';
import { botService } from '@/services/botService';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { MonthlyColumnChart } from '../charts/MonthlyColumnChart';
import { StatTile } from '../charts/StatTile';
import { calcularMetricas, estaEmEspera } from './metricas';

interface BotPainelViewProps {
  config: BotConfig | null;
  heartbeat: BotHeartbeat | null;
  conversas: BotConversa[];
  resumo: BotMensagemResumo[];
  usos: BotUso[];
  onChange: () => Promise<void>;
}

const PERIODOS = [
  { dias: 7, label: '7 dias' },
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
];

/** O bot grava um sinal de vida a cada 15 s: se passou de 60 s sem sinal, consideramos offline. */
const LIMITE_OFFLINE_MS = 60_000;

function textoHa(iso: string): string {
  const seg = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seg < 60) return `${seg} s`;
  if (seg < 3600) return `${Math.round(seg / 60)} min`;
  if (seg < 86400) return `${Math.round(seg / 3600)} h`;
  return `${Math.round(seg / 86400)} dias`;
}

export function BotPainelView({ config, heartbeat, conversas, resumo, usos, onChange }: BotPainelViewProps) {
  const [dias, setDias] = useState(30);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const online = heartbeat !== null && Date.now() - Date.parse(heartbeat.ts) < LIMITE_OFFLINE_MS;
  const metricas = useMemo(
    () => calcularMetricas(conversas, resumo, usos, dias, config?.cambioUsdBrl ?? 5.5),
    [conversas, resumo, usos, dias, config?.cambioUsdBrl]
  );
  const esperandoVoce = conversas.filter((c) => estaEmEspera(c) || c.estado === 'humano').length;

  if (!config) {
    return (
      <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-semibold">O bot ainda não criou as configurações do painel.</p>
        <p className="mt-1">
          Feche a janela do bot no seu computador e abra o <strong>iniciar.bat</strong> de novo. Na primeira vez que ele
          liga com a versão nova, as configurações aparecem aqui.
        </p>
      </div>
    );
  }

  const alternar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await botService.updateConfig({ ativo: !config.ativo });
      await onChange();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  };

  let statusTitulo = 'Offline';
  let statusDetalhe = 'O bot não envia sinal de vida. Confira se o computador está ligado e se a janela do bot está aberta.';
  let statusCor = 'bg-red-500';
  if (online && heartbeat) {
    if (!heartbeat.whatsapp) {
      statusTitulo = 'Online, mas o WhatsApp está desconectado';
      statusDetalhe = 'O bot está ligado, porém o WhatsApp caiu. Ele reconecta sozinho; se não voltar, abra a janela do bot.';
      statusCor = 'bg-amber-500';
    } else if (heartbeat.pausado) {
      statusTitulo = 'Pausado';
      statusDetalhe = heartbeat.motivoPausa ? `Motivo: ${heartbeat.motivoPausa}.` : 'O bot está pausado.';
      statusCor = 'bg-amber-500';
    } else {
      statusTitulo = 'Funcionando';
      statusDetalhe = 'Online, WhatsApp conectado e atendendo os leads.';
      statusCor = 'bg-accent-500';
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl2 border border-navy-100 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${statusCor}`} aria-hidden />
            <div>
              <p className="text-lg font-bold text-navy-900">{statusTitulo}</p>
              <p className="max-w-xl text-sm text-navy-500">{statusDetalhe}</p>
              <p className="mt-1 text-xs text-navy-400">
                {heartbeat ? `Último sinal há ${textoHa(heartbeat.ts)}.` : 'Nenhum sinal recebido ainda.'}
                {heartbeat && heartbeat.modoTeste ? ' MODO_TESTE ligado: nada é enviado de verdade.' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={alternar}
            disabled={salvando}
            className={config.ativo ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn bg-accent-500 text-navy-950 hover:bg-accent-400'}
          >
            {salvando ? 'Salvando…' : config.ativo ? 'Desligar o bot' : 'Ligar o bot'}
          </button>
        </div>

        {erro && <p className="field-error mt-3">{erro}</p>}

        {config.listaTeste.trim() !== '' && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
            Modo de teste: o bot só fala com os números da lista de teste. Para atender todos os leads, esvazie a lista em
            Configurações.
          </p>
        )}
        {config.horarioAtivo && (
          <p className="mt-3 text-sm text-navy-500">
            Horário de funcionamento ligado: {config.horarioInicio} às {config.horarioFim} (Brasília).
          </p>
        )}
      </section>

      {esperandoVoce > 0 && (
        <p className="rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white">
          {esperandoVoce} conversa{esperandoVoce > 1 ? 's' : ''} já passou{esperandoVoce > 1 ? 'aram' : ''} para você. Veja na aba Conversas.
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-navy-400">Resultados</h3>
          <div className="flex gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => setDias(p.dias)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  dias === p.dias ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Leads abordados" value={String(metricas.abordados)} hint={`${metricas.mensagensBot} mensagens do bot`} />
          <StatTile
            label="Responderam"
            value={String(metricas.responderam)}
            hint={`${formatPercent(metricas.taxaResposta)} dos abordados`}
            accent="accent"
          />
          <StatTile
            label="Consultorias marcadas"
            value={String(metricas.agendados)}
            hint={`${formatPercent(metricas.taxaAgendamento)} dos abordados`}
            accent="accent"
          />
          <StatTile label="Passaram para você" value={String(metricas.passaramParaVoce)} hint={`${metricas.pediramParar} pediram para parar`} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Mensagens dos leads" value={String(metricas.mensagensLead)} />
          <StatTile label="Suas mensagens" value={String(metricas.mensagensGabriel)} hint="enviadas por você" />
          <StatTile
            label="Custo estimado da API"
            value={formatCurrency(metricas.custoBrl)}
            hint={`US$ ${metricas.custoUsd.toFixed(2)} · câmbio ${config.cambioUsdBrl.toLocaleString('pt-BR')}`}
          />
          <StatTile
            label="Custo por lead abordado"
            value={formatCurrency(metricas.custoPorLeadBrl)}
            hint={`${(metricas.tokensEntrada / 1000).toFixed(0)} mil tokens de entrada`}
          />
        </div>
        <p className="mt-2 text-xs text-navy-400">
          O custo é calculado pelo consumo real registrado pelo bot (US$ 2 por milhão de tokens de entrada e US$ 10 por
          milhão de saída) e convertido pelo câmbio das Configurações. É uma estimativa: o valor oficial está no console da
          Anthropic.
        </p>
      </section>

      <section className="rounded-xl2 border border-navy-100 bg-white p-6 shadow-soft">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-navy-400">Mensagens do bot por dia (14 dias)</h3>
        <MonthlyColumnChart data={metricas.porDia} />
      </section>
    </div>
  );
}
