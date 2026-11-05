import { useEffect, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { useCalculatorForm } from '@/hooks/useCalculatorForm';
import { ProgressBar } from './ProgressBar';
import { LeadForm } from './LeadForm';
import { ObraDataStep } from './ObraDataStep';
import { AreasStep } from './AreasStep';
import { Confirmacao } from './Confirmacao';

interface CalculatorProps {
  /** true = só o cartão da calculadora (dentro do topo da página), sem a seção e o título próprios. */
  embedded?: boolean;
  /** Avisa quando os dados foram enviados (ou a tela volta ao início), para o topo da página ajustar o layout. */
  onResultChange?: (enviado: boolean) => void;
}

/**
 * Calculadora em 3 etapas. IMPORTANTE: o valor do cálculo NÃO aparece mais na
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
        <div className="mb-6 text-center sm:text-left">
          <span className="section-eyebrow">Simulação gratuita</span>
          <h2 className="mt-1 text-xl font-bold text-navy-900 sm:text-2xl">
            Conte sobre a sua obra e veja como reduzir o INSS
          </h2>
          <p className="mt-2 text-sm text-navy-500">
            Responda em 1 minuto. Um analista entra em contato pelo WhatsApp para conversar sobre a sua obra.
          </p>
        </div>
      )}

      {!enviado && (
        <div className="mb-8">
          <ProgressBar currentStep={step} />
        </div>
      )}

      {!enviado && step === 1 && (
        <form onSubmit={handleStepSubmit} noValidate>
          <LeadForm data={data} errors={errors} onChange={updateField} />
          <div className="mt-8 flex justify-end">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Continuar
            </button>
          </div>
        </form>
      )}

      {!enviado && step === 2 && (
        <form onSubmit={handleStepSubmit} noValidate>
          <ObraDataStep data={data} errors={errors} onChange={updateField} />
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
          <AreasStep data={data} errors={errors} onChange={updateField} />
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={goBack} className="btn-outline" disabled={isSubmitting}>
              Voltar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar minha simulação'}
            </button>
          </div>
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
          eyebrow="Simulação gratuita"
          title="Conte sobre a sua obra e veja como reduzir o INSS"
          description="Preencha os dados da sua obra. Um analista entra em contato pelo WhatsApp para conversar sobre o seu caso."
        />
        {cartao}
      </Container>
    </section>
  );
}
