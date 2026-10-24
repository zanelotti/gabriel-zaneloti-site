import { useEffect, useState, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { useCalculatorForm } from '@/hooks/useCalculatorForm';
import { generateFallbackWhatsAppMessage } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';
import { ProgressBar } from './ProgressBar';
import { LeadForm } from './LeadForm';
import { ObraDataStep } from './ObraDataStep';
import { AreasStep } from './AreasStep';
import { ResultCard } from './ResultCard';
import { CalculatingLoader } from './CalculatingLoader';

interface CalculatorProps {
  /** true = só o cartão da calculadora (dentro do topo da página), sem a seção e o título próprios. */
  embedded?: boolean;
  /** Avisa quando existe (ou deixa de existir) um resultado, para o topo da página poder dar mais largura ao cartão. */
  onResultChange?: (temResultado: boolean) => void;
}

export function Calculator({ embedded = false, onResultChange }: CalculatorProps = {}) {
  const { data, step, errors, result, calcError, isSubmitting, updateField, goNext, goBack, submit, reset } =
    useCalculatorForm();

  // Controla quando o ResultCard é de fato revelado: o cálculo em si é
  // instantâneo, mas mostramos o CalculatingLoader por alguns instantes antes
  // de revelar o resultado, para transmitir que uma análise real está
  // acontecendo. Volta a false sempre que `result` é limpo (nova simulação).
  const [revealResult, setRevealResult] = useState(false);
  useEffect(() => {
    if (!result) setRevealResult(false);
  }, [result]);

  useEffect(() => {
    onResultChange?.(Boolean(result));
  }, [result, onResultChange]);

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
          {embedded && !result && (
            <div className="mb-6 text-center sm:text-left">
              <span className="section-eyebrow">Simulação gratuita</span>
              <h2 className="mt-1 text-xl font-bold text-navy-900 sm:text-2xl">
                Descubra quanto você pode economizar no INSS da sua obra
              </h2>
            </div>
          )}

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
                  {isSubmitting ? 'Calculando...' : 'Calcular'}
                </button>
              </div>
            </form>
          )}

          {result && !revealResult && <CalculatingLoader onDone={() => setRevealResult(true)} />}

          {result && revealResult && <ResultCard data={data} result={result} onReset={reset} />}

          {!result && calcError && (
            <div className="animate-fade-in-up text-center sm:text-left">
              <h3 className="text-xl font-bold text-navy-900">
                Não conseguimos gerar uma estimativa automática agora
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-navy-500">
                Isso pode acontecer para obras com datas fora do período que nossa calculadora cobre hoje.
                Seus dados já foram registrados — fale direto com o Gabriel pelo WhatsApp que ele analisa sua
                obra manualmente.
              </p>
              <a
                href={generateFallbackWhatsAppMessage(data)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary mt-5 w-full sm:w-auto"
                onClick={() => trackEvent('whatsapp_clicked', { origem: 'fallback_calculo' })}
              >
                Falar com o Gabriel no WhatsApp
              </a>
              <button type="button" onClick={reset} className="mt-5 block text-sm font-semibold text-navy-500 underline">
                Fazer uma nova simulação
              </button>
            </div>
          )}
        </div>
  );

  if (embedded) return cartao;

  return (
    <section id="calculadora" className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Simulação gratuita"
          title="Descubra quanto você pode economizar no INSS da sua obra"
          description="Preencha os dados da sua obra para receber uma estimativa inicial e descobrir o potencial de economia."
        />
        {cartao}
      </Container>
    </section>
  );
}
