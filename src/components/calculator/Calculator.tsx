import type { FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { useCalculatorForm } from '@/hooks/useCalculatorForm';
import { ProgressBar } from './ProgressBar';
import { LeadForm } from './LeadForm';
import { ObraDataStep } from './ObraDataStep';
import { AreasStep } from './AreasStep';
import { ResultCard } from './ResultCard';

export function Calculator() {
  const { data, step, errors, result, isSubmitting, updateField, goNext, goBack, submit, reset } =
    useCalculatorForm();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleStepSubmit = (event: FormEvent) => {
    event.preventDefault();
    goNext();
  };

  return (
    <section id="calculadora" className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Simulação gratuita"
          title="Descubra quanto você pode economizar no INSS da sua obra"
          description="Preencha os dados da sua obra para receber uma estimativa inicial e descobrir o potencial de economia."
        />

        <div className="mx-auto mt-10 max-w-2xl rounded-xl2 border border-navy-100 bg-white p-6 shadow-card sm:p-10">
          {!result && (
            <div className="mb-8">
              <ProgressBar currentStep={step} />
            </div>
          )}

          {!result && step === 1 && (
            <form onSubmit={handleStepSubmit} noValidate>
              <LeadForm data={data} errors={errors} onChange={updateField} />
              <div className="mt-8 flex justify-end">
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  Continuar
                </button>
              </div>
            </form>
          )}

          {!result && step === 2 && (
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

          {!result && step === 3 && (
            <form onSubmit={handleSubmit} noValidate>
              <AreasStep data={data} errors={errors} onChange={updateField} />
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={goBack} className="btn-outline" disabled={isSubmitting}>
                  Voltar
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Calculando...' : 'Calcular minha simulação'}
                </button>
              </div>
            </form>
          )}

          {result && <ResultCard data={data} result={result} onReset={reset} />}
        </div>
      </Container>
    </section>
  );
}
