import { useEffect, useState } from 'react';
import { botService, type BotConfig, type BotEstrategia } from '@/services/botService';

interface BotConfigViewProps {
  config: BotConfig | null;
  onChange: () => Promise<void>;
}

interface Form {
  assistenteNome: string;
  tetoMensagens24h: string;
  economiaMinReuniao: string;
  listaTeste: string;
  horarioAtivo: boolean;
  horarioInicio: string;
  horarioFim: string;
  cambioUsdBrl: string;
  estrategia: BotEstrategia;
}

function paraForm(c: BotConfig): Form {
  return {
    assistenteNome: c.assistenteNome,
    tetoMensagens24h: String(c.tetoMensagens24h),
    economiaMinReuniao: String(c.economiaMinReuniao),
    listaTeste: c.listaTeste,
    horarioAtivo: c.horarioAtivo,
    horarioInicio: c.horarioInicio,
    horarioFim: c.horarioFim,
    cambioUsdBrl: String(c.cambioUsdBrl),
    estrategia: c.estrategia,
  };
}

export function BotConfigView({ config, onChange }: BotConfigViewProps) {
  const [form, setForm] = useState<Form | null>(config ? paraForm(config) : null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Carrega o formulário uma vez; depois disso, o que o Gabriel digita não é sobrescrito pela atualização automática.
  useEffect(() => {
    if (config && form === null) setForm(paraForm(config));
  }, [config, form]);

  if (!config || !form) {
    return <p className="text-sm text-navy-400">O bot ainda não criou as configurações. Abra o iniciar.bat de novo.</p>;
  }

  const set = <K extends keyof Form>(campo: K, valor: Form[K]) => setForm({ ...form, [campo]: valor });

  const salvar = async () => {
    setMsg(null);
    const teto = Number(form.tetoMensagens24h);
    const eco = Number(form.economiaMinReuniao.replace(',', '.'));
    const cambio = Number(form.cambioUsdBrl.replace(',', '.'));
    const nome = form.assistenteNome.trim();
    if (!nome || nome.length > 30) return setMsg({ tipo: 'erro', texto: 'O nome da assistente precisa ter de 1 a 30 letras.' });
    if (!Number.isInteger(teto) || teto < 1 || teto > 5000) return setMsg({ tipo: 'erro', texto: 'O limite de mensagens deve ser um número inteiro de 1 a 5000.' });
    if (!Number.isFinite(eco) || eco < 0) return setMsg({ tipo: 'erro', texto: 'O valor mínimo de economia deve ser um número (0 ou mais).' });
    if (!Number.isFinite(cambio) || cambio <= 0) return setMsg({ tipo: 'erro', texto: 'O câmbio deve ser um número maior que zero.' });
    if (!/^\d{1,2}:\d{2}$/.test(form.horarioInicio) || !/^\d{1,2}:\d{2}$/.test(form.horarioFim)) {
      return setMsg({ tipo: 'erro', texto: 'Informe o horário no formato 08:00.' });
    }

    setSalvando(true);
    try {
      await botService.updateConfig({
        assistenteNome: nome,
        tetoMensagens24h: teto,
        economiaMinReuniao: eco,
        listaTeste: form.listaTeste.trim(),
        horarioAtivo: form.horarioAtivo,
        horarioInicio: form.horarioInicio,
        horarioFim: form.horarioFim,
        cambioUsdBrl: cambio,
        estrategia: form.estrategia,
      });
      await onChange();
      setMsg({ tipo: 'ok', texto: 'Salvo. O bot aplica em até 15 segundos, sem precisar reiniciar.' });
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não consegui salvar.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-2xl rounded-xl2 border border-navy-100 bg-white p-6 shadow-soft">
      <div className="grid gap-5">
        <div>
          <label className="field-label">Nome da assistente</label>
          <input className="field-input" value={form.assistenteNome} onChange={(e) => set('assistenteNome', e.target.value)} />
          <p className="mt-1 text-xs text-navy-400">Aparece na primeira mensagem: "Aqui é Lia, assistente do Gabriel…".</p>
        </div>

        <div className="rounded-xl border border-navy-100 p-4">
          <label className="field-label">Estratégia de venda</label>
          <div className="mt-2 grid gap-3">
            <label className="flex items-start gap-3 text-sm text-navy-700">
              <input
                type="radio"
                name="estrategia"
                checked={form.estrategia === 'conversa'}
                onChange={() => set('estrategia', 'conversa')}
                className="mt-1 h-4 w-4"
              />
              <span>
                <strong>Vender pela conversa (recomendado)</strong>
                <br />
                <span className="text-xs text-navy-400">
                  A assistente entende o caso, passa o máximo de valor do serviço, usa todas as técnicas de negociação e conduz até a decisão. A
                  consultoria vira plano B: casos complexos, dúvidas que ela não sabe responder, pedido do lead ou quando percebe que a pessoa não vai
                  fechar só pela conversa.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-navy-700">
              <input
                type="radio"
                name="estrategia"
                checked={form.estrategia === 'consultoria'}
                onChange={() => set('estrategia', 'consultoria')}
                className="mt-1 h-4 w-4"
              />
              <span>
                <strong>Levar para a consultoria</strong>
                <br />
                <span className="text-xs text-navy-400">
                  A assistente entende o caso, passa valor e propõe a consultoria gratuita com você como próximo passo.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="field-label">Lista de teste (números separados por vírgula)</label>
          <input
            className="field-input"
            placeholder="21999998888, 11988887777"
            value={form.listaTeste}
            onChange={(e) => set('listaTeste', e.target.value)}
          />
          <p className="mt-1 text-xs font-medium text-amber-700">
            Atenção: se preenchida, o bot só fala com esses números. <strong>Vazia = o bot fala com todos os leads novos.</strong>
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label">Limite de mensagens em 24 h</label>
            <input className="field-input" inputMode="numeric" value={form.tetoMensagens24h} onChange={(e) => set('tetoMensagens24h', e.target.value)} />
            <p className="mt-1 text-xs text-navy-400">Trava de segurança. Se atingir, o bot pausa e avisa por e-mail.</p>
          </div>
          <div>
            <label className="field-label">Economia mínima para oferecer reunião (R$)</label>
            <input className="field-input" inputMode="decimal" value={form.economiaMinReuniao} onChange={(e) => set('economiaMinReuniao', e.target.value)} />
            <p className="mt-1 text-xs text-navy-400">Abaixo disso o bot não oferece reunião e passa para você por texto.</p>
          </div>
        </div>

        <div className="rounded-xl border border-navy-100 p-4">
          <label className="flex items-center gap-3 text-sm font-semibold text-navy-800">
            <input type="checkbox" checked={form.horarioAtivo} onChange={(e) => set('horarioAtivo', e.target.checked)} className="h-4 w-4" />
            Limitar o horário de funcionamento
          </label>
          <p className="mt-1 text-xs text-navy-400">
            Desligado = o bot funciona 24 h por dia. Ligado = fora da janela ele fica quieto e, quando voltar, responde quem escreveu nesse intervalo (horário de Brasília).
          </p>
          {form.horarioAtivo && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Começa às</label>
                <input className="field-input" placeholder="08:00" value={form.horarioInicio} onChange={(e) => set('horarioInicio', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Termina às</label>
                <input className="field-input" placeholder="20:00" value={form.horarioFim} onChange={(e) => set('horarioFim', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="field-label">Câmbio do dólar para estimar custos (R$)</label>
          <input className="field-input sm:max-w-[200px]" inputMode="decimal" value={form.cambioUsdBrl} onChange={(e) => set('cambioUsdBrl', e.target.value)} />
        </div>

        {msg && <p className={`text-sm font-medium ${msg.tipo === 'ok' ? 'text-accent-700' : 'text-red-600'}`}>{msg.texto}</p>}

        <div>
          <button onClick={() => void salvar()} disabled={salvando} className="btn-primary">
            {salvando ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}
