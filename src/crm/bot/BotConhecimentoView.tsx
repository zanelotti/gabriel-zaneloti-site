import { useCallback, useEffect, useState } from 'react';
import { botService, type BotConhecimento } from '@/services/botService';

/**
 * Editor dos textos que a assistente usa para responder (parcelamento, serviços, sobre o Gabriel…).
 * O bot lê a lista a cada 15 s. Valores em R$ escritos aqui passam a poder ser citados por ele.
 */
export function BotConhecimentoView() {
  const [itens, setItens] = useState<BotConhecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');

  const carregar = useCallback(async () => {
    try {
      setItens(await botService.listConhecimento());
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar o conhecimento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const criar = async () => {
    const t = novoTitulo.trim();
    if (!t) return;
    try {
      await botService.createConhecimento(t);
      setNovoTitulo('');
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui criar.');
    }
  };

  if (loading) return <p className="text-sm text-navy-400">Carregando…</p>;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="rounded-xl bg-navy-50 p-4 text-sm text-navy-600">
        Estes são os textos que a assistente usa como fonte oficial: parcelamento, o que está incluído no serviço, quem é você.
        Se a resposta não estiver aqui nem nos documentos, ela não inventa: passa a conversa para você. As alterações valem em
        até 15 segundos, sem reiniciar o bot. Para documentos grandes (normativa, manual do SERO), continue usando a pasta
        <strong> documentos</strong> no computador.
      </p>

      {erro && <div className="rounded-xl2 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

      {itens.map((item) => (
        <ItemEditor key={item.id} item={item} onSaved={carregar} />
      ))}

      <div className="flex gap-2">
        <input
          className="field-input"
          placeholder="Título de um novo texto (ex.: Prazos)"
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
        />
        <button onClick={() => void criar()} disabled={novoTitulo.trim() === ''} className="btn-secondary whitespace-nowrap">
          Adicionar texto
        </button>
      </div>
    </div>
  );
}

function ItemEditor({ item, onSaved }: { item: BotConhecimento; onSaved: () => Promise<void> }) {
  const [titulo, setTitulo] = useState(item.titulo);
  const [conteudo, setConteudo] = useState(item.conteudo);
  const [ativo, setAtivo] = useState(item.ativo);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmaApagar, setConfirmaApagar] = useState(false);

  const alterado = titulo !== item.titulo || conteudo !== item.conteudo || ativo !== item.ativo;

  const salvar = async () => {
    setSalvando(true);
    setMsg(null);
    try {
      await botService.saveConhecimento({ id: item.id, titulo: titulo.trim() || item.titulo, conteudo, ativo });
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
      await botService.deleteConhecimento(item.id);
      await onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Não consegui apagar.');
    }
  };

  return (
    <div className="rounded-xl2 border border-navy-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="field-input max-w-sm font-semibold" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <label className="flex items-center gap-2 text-sm font-medium text-navy-600">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4" />
          Usar este texto
        </label>
      </div>
      <textarea
        className="field-input mt-3 min-h-[180px] font-mono text-sm"
        value={conteudo}
        onChange={(e) => setConteudo(e.target.value)}
      />
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
