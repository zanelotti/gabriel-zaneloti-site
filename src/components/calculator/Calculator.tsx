import { useEffect, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { useCalculatorForm } from '@/hooks/useCalculatorForm';
import { ProgressBar } from './ProgressBar';
import { LeadForm } from './LeadForm';
import { ObraDataStep } from './ObraDataStep';
import { AreasStep } from './AreasStep';
import { Confirmacao } from './Confirmacao';

/** O que vem na análise (a promessa das 24h precisa dizer o que a pessoa recebe). */
const NA_ANALISE = [
  'Quanto a Receita cobraria de INSS da sua obra',
  'Quanto dá para reduzir, com base na IN RFB 2.021/2021',
  'O que falta para regularizar e tirar a CND',
];

function ListaDaAnalise() {
  return (
    <ul className="mt-3 space-y-1.5">
      {NA_ANALISE.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-navy-700">
          <svg viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-600" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface CalculatorProps {
  /** true = só o cartão da calculadora (dentro do topo da página), sem a seção e o título próprios. */
  embedded?: boolean;
  /** Avisa quando os dados foram enviados (ou a tela volta ao início), para o topo da página ajustar o layout. */
  onResultChange?: (enviado: boolean) => void;
}

/**
 * Calculadora em 3 etapas: 1) obra, 2) áreas, 3) contato (o contato fica por último). IMPORTANTE: o valor do cálculo NÃO aparece mais na
 * tela do visitante — ele é calculado por trás (para o CRM e para o bot) e,
 * ao final, o visitante só vê uma confirmação: "um analista vai entrar em
 * contato pelo WhatsApp". Quem apresenta o valor do serviço é a conversa.
 */
export function Calculator({ embedded = false, onResultChange }: CalculatorProps = {}) {
  const { data, step, errors, enviado, isSubmitting, updateField, goNext, goBack, submit, reset } =
    useCalculatorForm();

  useEffect(() => {
    onResultChange?.(enviado);
  }, [enviado, onResultChange]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleStepSubmit = (event: FormEvent) => {
    event.preventDefault();
    goNext();
  };

  const cartao = (
    <div
      id={embedded ? 'calculadora' : undefined}
      className={
        embedded
          ? 'mx-auto w-full max-w-2xl scroll-mt-24 rounded-xl2 border border-navy-100 bg-white p-5 shadow-card sm:p-8'
          : 'mx-auto mt-10 max-w-2xl rounded-xl2 border border-navy-100 bg-white p-6 shadow-card sm:p-10'
      }
    >
      {embedded && !enviado && (
        <div className="mb-6">
          <span className="section-eyebrow">Análise gratuita em até 24h</span>
          <h2 className="mt-1 text-xl font-bold text-navy-900 sm:text-2xl">
            Descubra quanto dá para reduzir o INSS da sua obra
          </h2>
          {step === 1 && (
            <>
              <p className="mt-2 text-sm text-navy-500">
                Em até 24 horas você recebe no WhatsApp:
              </p>
              <ListaDaAnalise />
            </>
          )}
        </div>
      )}

      {!enviado && (
        <div className="mb-8">
          <ProgressBar currentStep={step} />
        </div>
      )}

      {!enviado && step === 1 && (
        <form onSubmit={handleStepSubmit} noValidate>
          <ObraDataStep data={data} errors={errors} onChange={updateField} />
          <div className="mt-8 flex justify-end">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Continuar
            </button>
          </div>
        </form>
      )}

      {!enviado && step === 2 && (
        <form onSubmit={handleStepSubmit} noValidate>
          <AreasStep data={data} errors={errors} onChange={updateField} />
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={goBack} className="btn-outline">
              Voltar
            </button>
            <button type="submit" className="btn-primary">
              Continuar
            </button>
          </div>
        </form>
      )}

      {!enviado && step === 3 && (
        <form onSubmit={handleSubmit} noValidate>
          <LeadForm data={data} errors={errors} onChange={updateField} />
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={goBack} className="btn-outline" disabled={isSubmitting}>
              Voltar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Receber minha análise grátis'}
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-navy-400 sm:text-right">Sem custo e sem compromisso.</p>
        </form>
      )}

      {enviado && <Confirmacao data={data} onReset={reset} />}
    </div>
  );

  if (embedded) return cartao;

  return (
    <section id="calculadora" className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Análise gratuita em até 24h"
          title="Descubra quanto dá para reduzir o INSS da sua obra"
          description="Responda sobre a obra em 1 minuto. Em até 24 horas você recebe a análise no WhatsApp."
        />
        {cartao}
      </Container>
    </section>
  );
}
