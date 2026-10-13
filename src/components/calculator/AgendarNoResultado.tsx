import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { onlyDigits } from '@/utils/formatters';
import { isValidEmail } from '@/utils/validation';
import { generateGenericWhatsAppLink } from '@/services/whatsapp';
import { setEnhancedConversionData, trackEvent } from '@/services/analytics';
import {
  AgendarError,
  FUSO_HORARIO,
  agendarConsultoria,
  baixarIcs,
  fetchHorarios,
  formatarDataHora,
  formatarHora,
  linkGoogleAgenda,
  rotuloDia,
  type AgendamentoConfirmado,
  type DiaLivre,
} from '@/services/agendamentoService';

const ORIGEM = 'resultado_simulacao';
const DIAS_INICIAIS = 3;
const HORARIOS_INICIAIS = 6;

type Carregamento = 'carregando' | 'pronto' | 'erro';

interface AgendarNoResultadoProps {
  nome: string;
  /** WhatsApp já digitado na calculadora (com ou sem máscara). */
  whatsapp: string;
  /** Resumo curto da simulação, enviado junto no campo "sobre a obra" do agendamento. */
  resumoObra: string;
  titulo: string;
  texto: string;
  /** Link do WhatsApp (com a simulação) para quem prefere falar agora. */
  whatsappUrl: string;
}

/** Data de hoje em Brasília, no formato yyyy-mm-dd. */
function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(new Date());
}

function Check({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Bloco "Próximo passo" da tela de resultado: o cliente escolhe um horário
 * livre da agenda do Gabriel e agenda a consultoria gratuita ali mesmo, sem
 * sair da simulação. Usa o MESMO sistema da seção "Agendar" do site
 * (/api/agenda-horarios e /api/agendar → Google Agenda + e-mail + CRM +
 * conversão do Google Ads). Nome e WhatsApp já vêm da calculadora; só falta
 * pedir o e-mail.
 */
export function AgendarNoResultado({ nome, whatsapp, resumoObra, titulo, texto, whatsappUrl }: AgendarNoResultadoProps) {
  const [estado, setEstado] = useState<Carregamento>('carregando');
  const [dias, setDias] = useState<DiaLivre[]>([]);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [horarioSel, setHorarioSel] = useState<string | null>(null);
  const [maisDias, setMaisDias] = useState(false);
  const [maisHorarios, setMaisHorarios] = useState(false);

  const [email, setEmail] = useState('');
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState<AgendamentoConfirmado | null>(null);

  const hoje = useMemo(hojeEmBrasilia, []);

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try {
      const data = await fetchHorarios();
      setDias(data.dias);
      setDiaSel((atual) => (atual && data.dias.some((d) => d.data === atual) ? atual : (data.dias[0]?.data ?? null)));
      setEstado('pronto');
    } catch {
      setEstado('erro');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const diaAtual = useMemo(() => dias.find((d) => d.data === diaSel) ?? null, [dias, diaSel]);
  const diasVisiveis = maisDias ? dias : dias.slice(0, DIAS_INICIAIS);
  const horariosDoDia = diaAtual?.horarios ?? [];
  const horariosVisiveis = maisHorarios ? horariosDoDia : horariosDoDia.slice(0, HORARIOS_INICIAIS);

  const escolherDia = (data: string) => {
    setDiaSel(data);
    setHorarioSel(null);
    setMaisHorarios(false);
    setErroEnvio(null);
  };

  const escolherHorario = (inicio: string) => {
    if (horarioSel !== inicio) trackEvent('agenda_horario_escolhido', { origem: ORIGEM });
    setHorarioSel(inicio);
    setErroEnvio(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (enviando) return;

    if (!horarioSel) {
      setErroEnvio('Escolha um horário acima para continuar.');
      return;
    }
    if (!email.trim()) {
      setErroEmail('Informe seu e-mail para eu enviar a confirmação.');
      return;
    }
    if (!isValidEmail(email)) {
      setErroEmail('Informe um e-mail válido.');
      return;
    }
    setErroEmail(null);

    setEnviando(true);
    setErroEnvio(null);
    try {
      const resultado = await agendarConsultoria({
        nome: nome.trim() || 'Cliente do site',
        email: email.trim(),
        whatsapp: onlyDigits(whatsapp),
        observacoes: resumoObra.slice(0, 300),
        inicio: horarioSel,
        website: '',
      });
      setEnhancedConversionData({ email: email.trim(), whatsappDigits: onlyDigits(whatsapp) });
      trackEvent('consultoria_agendada', { origem: ORIGEM });
      setConfirmado(resultado);
    } catch (error) {
      const motivo = error instanceof AgendarError ? error.reason : 'unavailable';
      if (motivo === 'slot_taken') {
        setErroEnvio('Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário.');
        setHorarioSel(null);
        void carregar();
      } else if (motivo === 'ja_agendado') {
        const quando = error instanceof AgendarError && error.inicioExistente ? formatarDataHora(error.inicioExistente) : null;
        setErroEnvio(
          `Você já tem uma consultoria agendada${quando ? ` para ${quando}` : ''}. Para remarcar, fale comigo pelo WhatsApp.`
        );
      } else if (motivo === 'invalid') {
        setErroEnvio('Confira os dados informados e tente novamente.');
      } else {
        setErroEnvio('Não consegui concluir o agendamento agora. Tente novamente ou fale comigo pelo WhatsApp.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const botaoWhatsApp = (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
      onClick={() => trackEvent('whatsapp_clicked', { origem: 'resultado_agendar' })}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M12.04 2a9.93 9.93 0 0 0-8.5 15.05L2 22l5.07-1.5A9.93 9.93 0 1 0 12.04 2Zm5.8 14.05c-.25.7-1.45 1.33-2 1.4-.5.07-1.13.1-1.82-.12a16.6 16.6 0 0 1-1.65-.61c-2.9-1.25-4.78-4.17-4.92-4.37-.14-.2-1.17-1.56-1.17-2.97s.74-2.1 1-2.39c.26-.28.57-.35.76-.35h.55c.18 0 .42-.07.65.5.25.6.84 2.06.91 2.2.07.15.12.32.02.51-.1.2-.15.32-.3.5l-.45.52c-.15.15-.3.31-.13.6.17.3.77 1.27 1.65 2.05 1.13 1 2.09 1.32 2.39 1.47.3.14.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.28.1 1.75.83 2.05.98.3.15.5.22.57.35.07.12.07.72-.18 1.42Z" />
      </svg>
      Prefiro falar agora no WhatsApp
    </a>
  );

  return (
    <div className="mt-6 rounded-xl2 bg-navy-900 p-5 text-white shadow-card sm:p-7">
      {confirmado ? (
        <div role="status">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-400/20 text-accent-300">
            <Check className="h-6 w-6" />
          </span>
          <h4 className="mt-4 text-xl font-extrabold">Análise agendada!</h4>
          <p className="mt-2 text-base font-bold text-amber-300">{formatarDataHora(confirmado.inicio)}</p>
          <p className="text-xs font-medium text-navy-200">Horário de Brasília</p>
          <p className="mt-4 text-sm leading-relaxed text-navy-100">
            {confirmado.videoLink ? (
              <>
                A reunião será neste link:{' '}
                <a href={confirmado.videoLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-300 underline">
                  {confirmado.videoLink}
                </a>
                . Vou analisar a sua obra com você e apresentar uma proposta personalizada.
              </>
            ) : (
              <>No horário marcado, eu te chamo pelo WhatsApp. Vou analisar a sua obra com você e apresentar uma proposta personalizada.</>
            )}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a href={linkGoogleAgenda(confirmado)} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Adicionar ao Google Agenda
            </a>
            <button
              type="button"
              onClick={() => baixarIcs(confirmado)}
              className="btn border-2 border-white/30 text-white hover:bg-white/10"
            >
              Baixar arquivo (.ics)
            </button>
          </div>
          <a
            href={generateGenericWhatsAppLink('Olá, Gabriel! Acabei de agendar a análise gratuita pelo site.')}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-navy-200 underline hover:text-white"
          >
            Precisa remarcar? Fale comigo no WhatsApp
          </a>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-widest text-accent-300">Próximo passo · gratuito</p>
          <h4 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">{titulo}</h4>
          <p className="mt-3 text-sm leading-relaxed text-navy-100">{texto}</p>

          {estado === 'carregando' && (
            <p className="py-8 text-center text-sm font-medium text-navy-200" role="status">
              Carregando horários disponíveis…
            </p>
          )}

          {(estado === 'erro' || (estado === 'pronto' && dias.length === 0)) && (
            <div className="mt-5 rounded-xl bg-white/5 p-4 text-sm text-navy-100">
              <p className="font-bold text-white">
                {estado === 'erro' ? 'Não consegui carregar os horários agora.' : 'Sem horários livres no momento.'}
              </p>
              <p className="mt-1">Me chame no WhatsApp que combinamos o melhor horário para a sua análise gratuita.</p>
              {estado === 'erro' && (
                <button type="button" onClick={() => void carregar()} className="mt-3 text-sm font-semibold text-amber-300 underline">
                  Tentar de novo
                </button>
              )}
            </div>
          )}

          {estado === 'pronto' && dias.length > 0 && (
            <form onSubmit={handleSubmit} noValidate className="mt-5">
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Dia da análise">
                {diasVisiveis.map((dia) => {
                  const { semana, diaMes } = rotuloDia(dia.data);
                  const ativo = dia.data === diaSel;
                  return (
                    <button
                      key={dia.data}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => escolherDia(dia.data)}
                      className={`rounded-xl border-2 px-2 py-2.5 text-center transition-colors ${
                        ativo ? 'border-amber-400 bg-white/10' : 'border-white/15 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      <span className="block text-sm font-bold capitalize">{dia.data === hoje ? 'Hoje' : semana}</span>
                      <span className="block text-xs text-navy-200">{diaMes}</span>
                    </button>
                  );
                })}
              </div>
              {dias.length > DIAS_INICIAIS && (
                <button
                  type="button"
                  onClick={() => setMaisDias((v) => !v)}
                  className="mt-2 text-xs font-semibold text-navy-200 underline hover:text-white"
                >
                  {maisDias ? 'Ver menos dias' : 'Ver mais dias'}
                </button>
              )}

              <p className="mt-4 text-xs font-medium text-navy-200">Horários · Brasília</p>
              <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Horário da análise">
                {horariosVisiveis.map((horario) => {
                  const ativo = horario.inicio === horarioSel;
                  return (
                    <button
                      key={horario.inicio}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => escolherHorario(horario.inicio)}
                      className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition-colors ${
                        ativo ? 'border-amber-400 bg-white/10' : 'border-white/15 bg-white/5 hover:border-white/40'
                      }`}
                    >
                      {formatarHora(horario.inicio)}
                    </button>
                  );
                })}
              </div>
              {horariosDoDia.length > HORARIOS_INICIAIS && (
                <button
                  type="button"
                  onClick={() => setMaisHorarios((v) => !v)}
                  className="mt-2 text-xs font-semibold text-navy-200 underline hover:text-white"
                >
                  {maisHorarios ? 'Ver menos horários' : 'Ver mais horários'}
                </button>
              )}

              {horarioSel && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-amber-300">{formatarDataHora(horarioSel)}</p>
                  <label htmlFor="resultado-agenda-email" className="mt-3 block text-sm font-semibold text-white">
                    Seu e-mail <span className="font-normal text-navy-200">(para eu enviar a confirmação)</span>
                  </label>
                  <input
                    id="resultado-agenda-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={`field-input mt-1.5 ${erroEmail ? 'field-input-error' : ''}`}
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(erroEmail)}
                  />
                  {erroEmail && <p className="mt-1.5 text-sm font-medium text-red-300">{erroEmail}</p>}
                  <p className="mt-2 text-xs text-navy-200">
                    Vou usar o nome e o WhatsApp que você já informou na simulação.
                  </p>
                </div>
              )}

              {erroEnvio && (
                <p className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm font-medium text-red-200" role="alert">
                  {erroEnvio}
                </p>
              )}

              <button type="submit" disabled={enviando} className="btn-primary mt-5 w-full">
                {enviando ? 'Agendando…' : 'Agendar minha análise gratuita'}
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-navy-300">
                Ao agendar, você concorda com a{' '}
                <a href="/privacidade.html" className="underline hover:text-white">
                  Política de Privacidade
                </a>
                . Usaremos seus dados para confirmar a consultoria, entrar em contato e medir o resultado dos nossos anúncios.
              </p>
            </form>
          )}

          {botaoWhatsApp}
        </>
      )}
    </div>
  );
}
