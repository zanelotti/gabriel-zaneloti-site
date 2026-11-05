import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { CalculatorData } from '@/types/calculator';
import { formatArea } from '@/utils/formatters';
import { generateConfirmacaoWhatsAppLink } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';
import { DESTINACAO_LABEL, RESPONSAVEL_LABEL, estadoLabel } from '@/utils/labels';

// A agenda só é baixada quando o visitante clica em "Agendar consultoria" —
// assim ela não pesa no carregamento do site (principalmente no celular).
const AgendarNoResultado = lazy(() =>
  import('./AgendarNoResultado').then((modulo) => ({ default: modulo.AgendarNoResultado }))
);

interface ConfirmacaoProps {
  data: CalculatorData;
  onReset: () => void;
}

function primeiroNome(nome: string): string {
  const parte = nome.trim().split(/\s+/)[0] ?? '';
  if (!parte) return '';
  return parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1).toLocaleLowerCase('pt-BR');
}

const PASSOS = [
  { titulo: 'Dados recebidos', texto: 'Já estão com a nossa equipe.', feito: true },
  { titulo: 'Um analista chama você no WhatsApp', texto: 'Para conversar sobre a sua obra.', feito: false },
  { titulo: 'Entendemos o seu caso', texto: 'E mostramos como podemos ajudar.', feito: false },
];

/**
 * Tela exibida depois que o visitante envia a simulação. NÃO mostra nenhum
 * valor (INSS, economia, honorário): o cálculo fica guardado para o CRM e para
 * o bot, e quem apresenta o serviço é a conversa no WhatsApp. Aqui só tem:
 * confirmação + botão do WhatsApp + botão para agendar a consultoria.
 */
export function Confirmacao({ data, onReset }: ConfirmacaoProps) {
  const [agendaAberta, setAgendaAberta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const nome = primeiroNome(data.nome);

  useEffect(() => {
    raiz.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const resumoObra = [
    `Simulação no site: ${RESPONSAVEL_LABEL[data.responsavel] ?? '—'}`,
    DESTINACAO_LABEL[data.destinacao],
    data.areaPrincipal ? formatArea(data.areaPrincipal) : null,
    data.estado ? estadoLabel(data.estado) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const whatsappUrl = generateConfirmacaoWhatsAppLink(data);

  return (
    <div ref={raiz} id="resultado-simulacao" className="animate-fade-in-up scroll-mt-24" role="status">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <svg viewBox="0 0 16 16" fill="none" className="h-6 w-6" aria-hidden="true">
          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <h3 className="mt-4 text-2xl font-extrabold leading-tight text-navy-900 sm:text-3xl">
        {nome ? `${nome}, recebemos os dados da sua obra!` : 'Recebemos os dados da sua obra!'}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-navy-600">
        Um analista vai entrar em contato com você pelo WhatsApp para conversar sobre a sua obra e explicar como
        podemos ajudar. Fique de olho no celular.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full sm:w-auto"
          onClick={() => trackEvent('whatsapp_clicked', { origem: 'confirmacao' })}
        >
          Falar agora no WhatsApp
        </a>
        {!agendaAberta && (
          <button
            type="button"
            className="btn-outline w-full sm:w-auto"
            onClick={() => {
              trackEvent('click_agendar', { origem: 'confirmacao' });
              setAgendaAberta(true);
            }}
          >
            Agendar consultoria gratuita
          </button>
        )}
      </div>

      {agendaAberta && (
        <Suspense
          fallback={
            <p className="mt-6 py-6 text-center text-sm font-medium text-navy-500" role="status">
              Carregando horários…
            </p>
          }
        >
          <AgendarNoResultado
            nome={data.nome}
            whatsapp={data.whatsapp}
            resumoObra={resumoObra}
            titulo="Escolha o melhor horário"
            texto="Escolha um horário. Eu analiso a sua obra com você, sem custo e sem compromisso."
            whatsappUrl={whatsappUrl}
          />
        </Suspense>
      )}

      <ol className="mt-8 space-y-4 border-t border-navy-100 pt-6">
        {PASSOS.map((passo, indice) => (
          <li key={passo.titulo} className="flex gap-3.5">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                passo.feito ? 'bg-accent-500' : 'bg-navy-900'
              }`}
            >
              {passo.feito ? (
                <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                indice + 1
              )}
            </span>
            <div className="pt-0.5">
              <p className="text-sm font-bold text-navy-900">{passo.titulo}</p>
              <p className="text-sm text-navy-500">{passo.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 text-center sm:text-left">
        <button type="button" onClick={onReset} className="text-sm font-semibold text-navy-500 underline">
          Enviar os dados de outra obra
        </button>
      </div>
    </div>
  );
}
