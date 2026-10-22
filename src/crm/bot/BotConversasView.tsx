import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  botService,
  type BotComandoTipo,
  type BotConversa,
  type BotMensagem,
  type BotMensagemResumo,
} from '@/services/botService';
import type { Lead } from '@/types/lead';
import { maskWhatsApp } from '@/utils/formatters';
import { estaEmEspera } from './metricas';

interface BotConversasViewProps {
  leads: Lead[];
  conversas: BotConversa[];
  resumo: BotMensagemResumo[];
  onChange: () => Promise<void>;
}

type Filtro = 'todas' | 'voce' | 'ativas' | 'encerradas';

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'voce', label: 'Precisam de você' },
  { id: 'ativas', label: 'Com o bot' },
  { id: 'encerradas', label: 'Encerradas' },
];

const FUSO = 'America/Sao_Paulo';

function formatHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rotuloEstado(c: BotConversa): { texto: string; classe: string } {
  if (estaEmEspera(c)) return { texto: 'Passou para você', classe: 'bg-amber-100 text-amber-800' };
  switch (c.estado) {
    case 'ativa':
      return { texto: 'Com o bot', classe: 'bg-accent-100 text-accent-800' };
    case 'humano':
      return { texto: 'Com você', classe: 'bg-navy-200 text-navy-800' };
    case 'optout':
      return { texto: 'Pediu para parar', classe: 'bg-red-100 text-red-700' };
    default:
      return { texto: 'Encerrada', classe: 'bg-slate-200 text-slate-700' };
  }
}

export function BotConversasView({ leads, conversas, resumo, onChange }: BotConversasViewProps) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);

  const nomePorLead = useMemo(() => new Map(leads.map((l) => [l.id, l.nome])), [leads]);

  // Última mensagem de cada conversa (o resumo vem ordenado da mais nova para a mais antiga).
  const ultimaPorConversa = useMemo(() => {
    const mapa = new Map<string, BotMensagemResumo>();
    for (const m of resumo) if (!mapa.has(m.conversaId)) mapa.set(m.conversaId, m);
    return mapa;
  }, [resumo]);

  const aguardandoVoce = (c: BotConversa): boolean =>
    (estaEmEspera(c) || c.estado === 'humano') && ultimaPorConversa.get(c.id)?.direcao === 'lead';

  const lista = conversas.filter((c) => {
    if (filtro === 'voce') return estaEmEspera(c) || c.estado === 'humano';
    if (filtro === 'ativas') return c.estado === 'ativa' && !estaEmEspera(c);
    if (filtro === 'encerradas') return c.estado === 'encerrada' || c.estado === 'optout';
    return true;
  });

  const selecionada = conversas.find((c) => c.id === selecionadaId) ?? null;
  const nomeDe = (c: BotConversa) => {
    const cadastro = nomePorLead.get(c.leadId) || maskWhatsApp(c.telefone.replace(/^55/, ''));
    // Quando o cadastro tem nome de empresa, o bot pergunta o nome da pessoa e o CRM mostra os dois.
    return c.nomeContato && c.nomeContato !== cadastro ? `${c.nomeContato} (${cadastro})` : cadastro;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-xl2 border border-navy-100 bg-white shadow-soft">
        <div className="flex flex-wrap gap-1 border-b border-navy-100 p-3">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                filtro === f.id ? 'bg-navy-900 text-white' : 'text-navy-500 hover:bg-navy-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ul className="max-h-[70vh] overflow-y-auto">
          {lista.length === 0 && <li className="p-6 text-center text-sm text-navy-400">Nenhuma conversa aqui.</li>}
          {lista.map((c) => {
            const r = rotuloEstado(c);
            return (
              <li key={c.id}>
                <button
                  onClick={() => setSelecionadaId(c.id)}
                  className={`flex w-full flex-col gap-1 border-b border-navy-50 px-4 py-3 text-left hover:bg-navy-50 ${
                    selecionadaId === c.id ? 'bg-navy-50' : ''
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy-900">{nomeDe(c)}</span>
                    {aguardandoVoce(c) && <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">espera você</span>}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.classe}`}>{r.texto}</span>
                    <span className="text-[11px] text-navy-400">{formatHora(c.atualizadoEm)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="rounded-xl2 border border-navy-100 bg-white shadow-soft">
        {selecionada ? (
          <ConversaChat key={selecionada.id} conversa={selecionada} nome={nomeDe(selecionada)} onChange={onChange} />
        ) : (
          <p className="p-10 text-center text-sm text-navy-400">Escolha uma conversa na lista para ver as mensagens.</p>
        )}
      </section>
    </div>
  );
}

interface ConversaChatProps {
  conversa: BotConversa;
  nome: string;
  onChange: () => Promise<void>;
}

function ConversaChat({ conversa, nome, onChange }: ConversaChatProps) {
  const [mensagens, setMensagens] = useState<BotMensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    try {
      setMensagens(await botService.listMensagens(conversa.id));
    } catch {
      // mantém o que já estava na tela
    }
  }, [conversa.id]);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 5000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: 'end' });
  }, [mensagens.length]);

  // Manda o comando e acompanha até o bot executar (ele confere a fila a cada ~3 s).
  const executar = async (tipo: BotComandoTipo, textoMsg?: string): Promise<boolean> => {
    setAviso(null);
    setEnviando(true);
    try {
      const id = await botService.sendComando(tipo, conversa.id, textoMsg);
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const cmd = await botService.getComando(id);
        if (cmd?.status === 'feito') {
          await Promise.all([carregar(), onChange()]);
          return true;
        }
        if (cmd?.status === 'erro') {
          setAviso({ tipo: 'erro', texto: cmd.erro ?? 'O bot não conseguiu executar.' });
          return false;
        }
      }
      setAviso({
        tipo: 'erro',
        texto: 'O bot não respondeu em 18 segundos. Ele pode estar offline: veja o Painel. O comando expira em 10 minutos.',
      });
      return false;
    } catch (err) {
      setAviso({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Falha ao enviar o comando.' });
      return false;
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    if (await executar('enviar', t)) {
      setTexto('');
      setAviso({ tipo: 'ok', texto: 'Mensagem enviada. A conversa agora está com você (o bot ficou em silêncio).' });
    }
  };

  const r = rotuloEstado(conversa);
  const podeEnviar = conversa.estado !== 'optout';
  const comBot = conversa.estado === 'ativa';

  return (
    <div className="flex h-[70vh] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-5 py-3">
        <div>
          <p className="font-bold text-navy-900">{nome}</p>
          <p className="text-xs text-navy-400">
            <span className={`mr-2 rounded-full px-2 py-0.5 font-semibold ${r.classe}`}>{r.texto}</span>
            {conversa.observacao ? conversa.observacao.replace('ESPERA_GABRIEL: ', 'Motivo: ') : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {comBot ? (
            <button onClick={() => void executar('assumir')} disabled={enviando} className="rounded-full border-2 border-navy-800 px-4 py-1.5 text-xs font-semibold text-navy-800 hover:bg-navy-800 hover:text-white disabled:opacity-60">
              Assumir conversa
            </button>
          ) : (
            conversa.estado !== 'optout' && (
              <button onClick={() => void executar('devolver')} disabled={enviando} className="rounded-full bg-accent-500 px-4 py-1.5 text-xs font-semibold text-navy-950 hover:bg-accent-400 disabled:opacity-60">
                Devolver ao bot
              </button>
            )
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-navy-50/60 px-5 py-4">
        {mensagens.length === 0 && <p className="text-center text-sm text-navy-400">Sem mensagens.</p>}
        {mensagens.map((m) => {
          const doLead = m.direcao === 'lead';
          const cor = doLead ? 'bg-white text-navy-900' : m.direcao === 'bot' ? 'bg-accent-100 text-navy-900' : 'bg-navy-800 text-white';
          return (
            <div key={m.id} className={`flex ${doLead ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-soft ${cor}`}>
                <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                <p className={`mt-1 text-[10px] ${m.direcao === 'humano' ? 'text-navy-200' : 'text-navy-400'}`}>
                  {doLead ? 'Lead' : m.direcao === 'bot' ? 'Bot' : 'Você'} · {formatHora(m.criadoEm)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>

      <footer className="border-t border-navy-100 p-4">
        {aviso && (
          <p className={`mb-2 text-sm font-medium ${aviso.tipo === 'ok' ? 'text-accent-700' : 'text-red-600'}`}>{aviso.texto}</p>
        )}
        {podeEnviar ? (
          <div className="flex gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              placeholder="Escreva uma mensagem para o lead (sai pelo WhatsApp do bot)…"
              className="field-input flex-1 resize-none"
            />
            <button onClick={() => void enviar()} disabled={enviando || texto.trim() === ''} className="btn-primary self-end">
              {enviando ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-navy-400">Este lead pediu para não receber mais mensagens. Não é possível enviar.</p>
        )}
        {comBot && podeEnviar && (
          <p className="mt-2 text-xs text-navy-400">Ao enviar, a conversa passa para você e o bot fica em silêncio nela. Use "Devolver ao bot" para ele voltar.</p>
        )}
      </footer>
    </div>
  );
}
