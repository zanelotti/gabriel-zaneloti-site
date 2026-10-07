import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { maskWhatsApp, onlyDigits } from '@/utils/formatters';
import { isValidEmail, isValidWhatsApp } from '@/utils/validation';
import { generateGenericWhatsAppLink } from '@/services/whatsapp';
import { setEnhancedConversionData, trackEvent } from '@/services/analytics';
import {
  AgendarError,
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

const BENEFICIOS = [
  'Esclareço as suas dúvidas sobre o INSS da sua obra',
  'Analiso a sua situação e mostro onde pode haver redução',
  'Apresento uma proposta personalizada para o seu caso',
  'Sem custo e sem compromisso',
];

const PASSOS = [
  { titulo: 'Escolha o dia e o horário', texto: 'Só os horários livres da minha agenda aparecem aqui.' },
  { titulo: 'Deixe seus contatos', texto: 'Nome, WhatsApp e e-mail para eu confirmar com você.' },
  { titulo: 'Conversamos por ~10 minutos', texto: 'Tiro suas dúvidas e apresento a proposta feita para o seu caso.' },
];

type CarregamentoHorarios = 'carregando' | 'pronto' | 'erro';

interface Erros {
  nome?: string;
  email?: string;
  whatsapp?: string;
}

const LINK_WHATSAPP_FALLBACK = generateGenericWhatsAppLink(
  'Olá, Gabriel! Quero agendar a consultoria gratuita de 10 minutos.'
);

/**
 * Seção de agendamento da consultoria gratuita (~10 min): a pessoa escolhe
 * um horário livre da agenda do Gabriel, deixa os contatos e recebe a
 * confirmação na hora. O evento vai direto pro Google Agenda dele (notifica
 * o celular) e o contato fica salvo no CRM com a origem do clique, para uso
 * no Google Ads.
 */
export function Agendamento() {
  const [estado, setEstado] = useState<CarregamentoHorarios>('carregando');
  const [dias, setDias] = useState<DiaLivre[]>([]);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [horarioSel, setHorarioSel] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [website, setWebsite] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<AgendamentoConfirmado | null>(null);

  const carregar = useCallback(async () => {
    setEstado('carregando');
    try {
      const data = await fetchHorarios();
      setDias(data.dias);
      setDiaSel((atual) => (atual && data.dias.some((d) => d.data === atual) ? atual : data.dias[0]?.data ?? null));
      setEstado('pronto');
    } catch {
      setEstado('erro');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const diaAtual = useMemo(() => dias.find((d) => d.data === diaSel) ?? null, [dias, diaSel]);

  const escolherHorario = (inicio: string) => {
    if (horarioSel !== inicio) trackEvent('agenda_horario_escolhido', { origem: 'secao_agendamento' });
    setHorarioSel(inicio);
    setErroEnvio(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (enviando || !horarioSel) return;

    const proximosErros: Erros = {};
    if (nome.trim().length < 2) proximosErros.nome = 'Informe seu nome.';
    if (!email.trim()) proximosErros.email = 'Informe seu e-mail.';
    else if (!isValidEmail(email)) proximosErros.email = 'Informe um e-mail válido.';
    if (!whatsapp.trim()) proximosErros.whatsapp = 'Informe seu WhatsApp.';
    else if (!isValidWhatsApp(whatsapp)) proximosErros.whatsapp = 'Informe um WhatsApp válido, com DDD.';
    setErros(proximosErros);
    if (Object.keys(proximosErros).length > 0) return;

    setEnviando(true);
    setErroEnvio(null);
    try {
      const resultado = await agendarConsultoria({
        nome: nome.trim(),
        email: email.trim(),
        whatsapp: onlyDigits(whatsapp),
        observacoes: observacoes.trim(),
        inicio: horarioSel,
        website,
      });
      setEnhancedConversionData({ email: email.trim(), whatsappDigits: onlyDigits(whatsapp) });
      trackEvent('consultoria_agendada', { origem: 'secao_agendamento' });
      setConfirmado(resultado);
    } catch (error) {
      const motivo = error instanceof AgendarError ? error.reason : 'unavailable';
      if (motivo === 'slot_taken') {
        setErroEnvio('Esse horário acabou de ser reservado por outra pessoa. Escolha outro horário abaixo.');
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

  return (
    <section id="agendar" className="scroll-mt-20 bg-white py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="section-eyebrow">Consultoria gratuita · 10 minutos</p>
          <h2 className="section-title">Agende uma conversa rápida comigo</h2>
          <p className="mt-4 max-w-lg text-base text-navy-600 sm:text-lg">
            Em uma reunião de cerca de 10 minutos, eu esclareço as suas dúvidas e apresento uma proposta
            personalizada para o seu caso — pensada para a sua obra, e não um modelo igual para todo mundo.
          </p>

          <ul className="mt-6 space-y-2.5">
            {BENEFICIOS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm font-medium text-navy-700">
                <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden="true">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <ol className="mt-8 space-y-4">
            {PASSOS.map((passo, index) => (
              <li key={passo.titulo} className="flex gap-3.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-navy-900">{passo.titulo}</p>
                  <p className="text-sm text-navy-500">{passo.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl2 border border-navy-100 bg-navy-50 p-5 shadow-card sm:p-8">
          {confirmado ? (
            <Confirmacao agendamento={confirmado} />
          ) : estado === 'carregando' ? (
            <p className="py-10 text-center text-sm font-medium text-navy-400" role="status">
              Carregando horários disponíveis…
            </p>
          ) : estado === 'erro' || dias.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-base font-bold text-navy-900">
                {estado === 'erro' ? 'Não consegui carregar os horários agora.' : 'Sem horários livres no momento.'}
              </p>
              <p className="mt-2 text-sm text-navy-500">
                Me chame no WhatsApp que combinamos o melhor horário para a sua consultoria gratuita.
              </p>
              <a
                href={LINK_WHATSAPP_FALLBACK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-5"
                onClick={() => trackEvent('whatsapp_clicked', { origem: 'agendamento_fallback' })}
              >
                Agendar pelo WhatsApp
              </a>
              {estado === 'erro' && (
                <button type="button" onClick={() => void carregar()} className="mt-3 block w-full text-sm font-semibold text-navy-500 hover:text-navy-900">
                  Tentar de novo
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <h3 className="text-lg font-bold text-navy-900">1. Escolha o dia</h3>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Dia da consultoria">
                {dias.map((dia) => {
                  const { semana, diaMes } = rotuloDia(dia.data);
                  const ativo = dia.data === diaSel;
                  return (
                    <button
                      key={dia.data}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => {
                        setDiaSel(dia.data);
                        setHorarioSel(null);
                      }}
                      className={`rounded-xl border-2 px-2 py-2.5 text-center transition-colors ${
                        ativo
                          ? 'border-navy-900 bg-navy-900 text-white'
                          : 'border-navy-100 bg-white text-navy-700 hover:border-accent-500'
                      }`}
                    >
                      <span className="block text-[11px] font-semibold uppercase tracking-wide opacity-80">{semana}</span>
                      <span className="block text-base font-bold">{diaMes}</span>
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-6 text-lg font-bold text-navy-900">2. Escolha o horário</h3>
              <p className="text-xs font-medium text-navy-400">Horário de Brasília</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Horário da consultoria">
                {(diaAtual?.horarios ?? []).map((horario) => {
                  const ativo = horario.inicio === horarioSel;
                  return (
                    <button
                      key={horario.inicio}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => escolherHorario(horario.inicio)}
                      className={`rounded-xl border-2 px-2 py-2.5 text-sm font-bold transition-colors ${
                        ativo
                          ? 'border-accent-700 bg-accent-700 text-white'
                          : 'border-navy-100 bg-white text-navy-700 hover:border-accent-500'
                      }`}
                    >
                      {formatarHora(horario.inicio)}
                    </button>
                  );
                })}
              </div>

              {erroEnvio && !horarioSel && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
                  {erroEnvio}
                </p>
              )}

              {horarioSel && (
                <div className="mt-6 border-t border-navy-100 pt-6">
                  <h3 className="text-lg font-bold text-navy-900">3. Seus dados</h3>
                  <p className="text-sm font-bold text-accent-700">{formatarDataHora(horarioSel)}</p>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="agenda-nome" className="field-label">Nome</label>
                      <input
                        id="agenda-nome"
                        name="nome"
                        type="text"
                        autoComplete="name"
                        className={`field-input ${erros.nome ? 'field-input-error' : ''}`}
                        placeholder="Seu nome completo"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        aria-invalid={Boolean(erros.nome)}
                      />
                      {erros.nome && <p className="field-error">{erros.nome}</p>}
                    </div>

                    <div>
                      <label htmlFor="agenda-whatsapp" className="field-label">WhatsApp com DDD</label>
                      <input
                        id="agenda-whatsapp"
                        name="whatsapp"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        className={`field-input ${erros.whatsapp ? 'field-input-error' : ''}`}
                        placeholder="(21) 98521-3949"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
                        aria-invalid={Boolean(erros.whatsapp)}
                      />
                      {erros.whatsapp && <p className="field-error">{erros.whatsapp}</p>}
                    </div>

                    <div>
                      <label htmlFor="agenda-email" className="field-label">E-mail</label>
                      <input
                        id="agenda-email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        className={`field-input ${erros.email ? 'field-input-error' : ''}`}
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={Boolean(erros.email)}
                      />
                      {erros.email && <p className="field-error">{erros.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="agenda-obs" className="field-label">
                        Conte rapidamente sobre a obra <span className="font-normal text-navy-400">(opcional)</span>
                      </label>
                      <textarea
                        id="agenda-obs"
                        name="observacoes"
                        rows={3}
                        maxLength={300}
                        className="field-input resize-none"
                        placeholder="Ex.: casa de 180 m², obra concluída em 2019, ainda sem a certidão."
                        value={observacoes}
                        onChange={(e) => setObservacoes(e.target.value)}
                      />
                    </div>

                    {/* Campo-isca anti-robô: escondido de pessoas, robôs costumam preencher. */}
                    <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                      <label htmlFor="agenda-website">Não preencha este campo</label>
                      <input
                        id="agenda-website"
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                      />
                    </div>
                  </div>

                  {erroEnvio && (
                    <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
                      {erroEnvio}
                    </p>
                  )}

                  <button type="submit" disabled={enviando} className="btn-primary mt-6 w-full">
                    {enviando ? 'Agendando…' : 'Confirmar agendamento'}
                  </button>
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-navy-400">
                    Ao agendar, você concorda com a{' '}
                    <a href="/privacidade.html" className="underline hover:text-navy-700">Política de Privacidade</a>.
                    Usaremos seus dados para confirmar a consultoria, entrar em contato e medir o resultado dos nossos
                    anúncios.
                  </p>
                </div>
              )}
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}

function Confirmacao({ agendamento }: { agendamento: AgendamentoConfirmado }) {
  return (
    <div className="text-center sm:text-left" role="status">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700 sm:mx-0">
        <svg viewBox="0 0 16 16" fill="none" className="h-6 w-6" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3 className="mt-4 text-xl font-extrabold text-navy-900">Consultoria agendada!</h3>
      <p className="mt-2 text-base font-bold text-accent-700">{formatarDataHora(agendamento.inicio)}</p>
      <p className="text-xs font-medium text-navy-400">Horário de Brasília</p>

      <p className="mt-4 text-sm text-navy-600">
        {agendamento.videoLink ? (
          <>
            A reunião será neste link:{' '}
            <a href={agendamento.videoLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-700 underline">
              {agendamento.videoLink}
            </a>
            . Vou esclarecer as suas dúvidas e apresentar uma proposta personalizada para o seu caso.
          </>
        ) : (
          <>
            No horário marcado, eu te chamo pelo WhatsApp. Vou esclarecer as suas dúvidas e apresentar uma proposta
            personalizada para o seu caso.
          </>
        )}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a href={linkGoogleAgenda(agendamento)} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Adicionar ao Google Agenda
        </a>
        <button type="button" onClick={() => baixarIcs(agendamento)} className="btn-outline">
          Baixar arquivo (.ics)
        </button>
      </div>

      <a
        href={generateGenericWhatsAppLink('Olá, Gabriel! Acabei de agendar a consultoria gratuita pelo site.')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-sm font-semibold text-navy-500 underline hover:text-navy-900"
      >
        Precisa remarcar? Fale comigo no WhatsApp
      </a>
    </div>
  );
}
