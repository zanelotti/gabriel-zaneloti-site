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
  /** INSS que a Receita cobraria sem planejamento (null = não mostrar número, ex.: obra antiga com possível decadência). */
  inssSemPlanejamento: number | null;
  onReset: () => void;
}

function primeiroNome(nome: string): string {
  const parte = nome.trim().split(/\s+/)[0] ?? '';
  if (!parte) return '';
  return parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1).toLocaleLowerCase('pt-BR');
}

function reaisInteiros(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/**
 * Tela depois do envio (o contato vem ANTES do resultado). Mostra só o INSS que a
 * Receita cobraria sem planejamento; a redução fica para o WhatsApp, para o lead
 * ter motivo de chamar ou responder a Lia. Texto curto de propósito.
 */
export function Confirmacao({ data, inssSemPlanejamento, onReset }: ConfirmacaoProps) {
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
  const temNumero = inssSemPlanejamento !== null && inssSemPlanejamento > 0;

  return (
    <div ref={raiz} id="resultado-simulacao" className="animate-fade-in-up scroll-mt-24" role="status">
      <h3 className="text-2xl font-extrabold leading-tight text-navy-900">
        {nome ? `${nome}, aqui está o resultado` : 'Aqui está o resultado'}
      </h3>

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
        {temNumero ? (
          <>
            <p className="text-sm font-semibold text-amber-800">Sem planejamento, a Receita cobraria cerca de</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-navy-900">{reaisInteiros(inssSemPlanejamento)}</p>
          </>
        ) : (
          <p className="text-base font-bold text-navy-900">Sem planejamento, a Receita cobra o INSS da sua obra pelo valor cheio.</p>
        )}
      </div>

      <p className="mt-4 text-base leading-relaxed text-navy-700">
        <strong className="text-navy-900">Com um especialista, dá para pagar bem menos, dentro da lei.</strong> Eu mesmo
        vou te chamar no WhatsApp para mostrar quanto você economiza.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full sm:w-auto"
          onClick={() => trackEvent('whatsapp_clicked', { origem: 'confirmacao' })}
        >
          Ver quanto economizo no WhatsApp
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

      <div className="mt-6 text-center sm:text-left">
        <button type="button" onClick={onReset} className="text-sm font-semibold text-navy-500 underline">
          Enviar os dados de outra obra
        </button>
      </div>
    </div>
  );
}
