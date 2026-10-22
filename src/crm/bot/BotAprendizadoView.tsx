import { useCallback, useEffect, useState } from 'react';
import { botService, type BotAprendizado, type BotConfig } from '@/services/botService';

interface BotAprendizadoViewProps {
  config: BotConfig | null;
  onChange: () => Promise<void>;
}

/**
 * O que o bot aprendeu sozinho lendo as conversas em que você respondeu.
 * Aparece aqui para você conferir: dá para corrigir o texto, desativar (o bot para de usar) ou apagar.
 * A chave "Aprender automaticamente" liga e desliga o aprendizado inteiro.
 */
export function BotAprendizadoView({ config, onChange }: BotAprendizadoViewProps) {
  const [itens, setItens] = useState<BotAprendizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [trocando, setTrocando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setItens(await botService.listAprendizado());
      setErro(null);
    } catch (err) {
      setErro(
        err instanceof Error
          ? `${err.message} — confira se você rodou o arquivo supabase_bot_painel.sql de novo no Supabase.`
          : 'Falha ao carregar o aprendizado.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const ligado = config?.aprendizadoAtivo !== false;

  const alternar = async () => {
    setTrocando(true);
    try {
      await botService.updateConfig({ aprendizadoAtivo: !ligado });
      await onChange();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui alterar.');
    } finally {
      setTrocando(false);
    }
  };

  const ativos = itens.filter((i) => i.ativo).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="rounded-xl2 border border-navy-100 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-navy-900">Aprender automaticamente com as suas respostas</h3>
            <p className="mt-1 text-sm text-navy-500">
              {ligado ? 'Ligado.' : 'Desligado.'} {ativos} {ativos === 1 ? 'item ativo' : 'itens ativos'} em uso pela assistente.
            </p>
          </div>
          <button onClick={() => void alternar()} disabled={trocando || !config} className={ligado ? 'btn-secondary' : 'btn-primary'}>
            {ligado ? 'Desligar aprendizado' : 'Ligar aprendizado'}
          </button>
        </div>
        <p className="mt-3 text-sm text-navy-600">
          Quando você responde um lead (pelo WhatsApp ou pelo CRM) e a conversa fica parada por cerca de 30 minutos, o bot lê a
          conversa e guarda só o que for conhecimento geral, reescrito sem nome, valor, cidade ou dado do cliente. O que for
          específico da obra, preço, honorário ou negociação é descartado. Nas próximas conversas, a assistente usa isso como
          complemento: as regras do negócio e a aba Conhecimento sempre valem mais. Se algo estiver errado, corrija, desative ou
          apague aqui.
        </p>
      </div>

      {loading && <p className="text-sm text-navy-400">Carregando…</p>}
      {erro && <div className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
      {!loading && !erro && itens.length === 0 && (
        <p className="rounded-xl bg-navy-50 p-4 text-sm text-navy-600">
          Ainda não há nada aprendido. Quando você responder alguém e a conversa ficar parada, o que for geral aparece aqui.
        </p>
      )}

      {itens.map((item) => (
        <ItemEditor key={`${item.id}-${item.pergunta}-${item.resposta}-${item.ativo}`} item={item} onSaved={carregar} />
      ))}
    </div>
  );
}

function ItemEditor({ item, onSaved }: { item: BotAprendizado; onSaved: () => Promise<void> }) {
  const [topico, setTopico] = useState(item.topico);
  const [pergunta, setPergunta] = useState(item.pergunta);
  const [resposta, setResposta] = useState(item.resposta);
  const [ativo, setAtivo] = useState(item.ativo);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmaApagar, setConfirmaApagar] = useState(false);

  const alterado = topico !== item.topico || pergunta !== item.pergunta || resposta !== item.resposta || ativo !== item.ativo;
  const quando = new Date(item.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const salvar = async () => {
    if (!pergunta.trim() || !resposta.trim()) {
      setMsg('Pergunta e resposta não podem ficar vazias.');
      return;
    }
    setSalvando(true);
    setMsg(null);
    try {
      await botService.saveAprendizado({ id: item.id, topico: topico.trim(), pergunta: pergunta.trim(), resposta: resposta.trim(), ativo });
      await onSaved();
      setMsg('Salvo.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async () => {
    try {
      await botService.deleteAprendizado(item.id);
      await onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não consegui apagar.');
    }
  };

  return (
    <div className={`rounded-xl2 border border-navy-100 bg-white p-5 shadow-soft ${ativo ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="field-input max-w-xs font-semibold"
          placeholder="Assunto"
          value={topico}
          onChange={(e) => setTopico(e.target.value)}
        />
        <div className="flex items-center gap-4">
          <span className="text-xs text-navy-400">Aprendido em {quando}</span>
          <label className="flex items-center gap-2 text-sm font-medium text-navy-600">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
            Usar
          </label>
        </div>
      </div>
      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-navy-400">Dúvida</label>
      <textarea className="field-input mt-1 min-h-[56px] text-sm" value={pergunta} onChange={(e) => setPergunta(e.target.value)} />
      <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-navy-400">Resposta</label>
      <textarea className="field-input mt-1 min-h-[96px] text-sm" value={resposta} onChange={(e) => setResposta(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={() => void salvar()} disabled={salvando || !alterado} className="btn-primary px-5 py-2.5">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        {confirmaApagar ? (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-red-600">Apagar de vez?</span>
            <button onClick={() => void apagar()} className="font-semibold text-red-600 hover:underline">Sim, apagar</button>
            <button onClick={() => setConfirmaApagar(false)} className="font-semibold text-navy-500 hover:underline">Cancelar</button>
          </span>
        ) : (
          <button onClick={() => setConfirmaApagar(true)} className="text-sm font-semibold text-navy-400 hover:text-red-600">
            Apagar
          </button>
        )}
        {msg && <span className="text-sm font-medium text-navy-500">{msg}</span>}
      </div>
    </div>
  );
}
