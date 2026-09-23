import { useEffect, useState } from 'react';

const STAGES = [
  'Analisando os dados da sua obra...',
  'Verificando o Fator de Ajuste aplicável...',
  'Aplicando as reduções previstas na IN RFB nº 2.021/2021...',
  'Calculando o valor final estimado...',
];

const STEP_DURATION_MS = 480;

interface CalculatingLoaderProps {
  /** Chamado quando a sequência de etapas termina de ser exibida. */
  onDone: () => void;
}

/**
 * Loader "inteligente" exibido entre o envio da etapa 3 e a revelação do
 * resultado: percorre visualmente as etapas reais do cálculo (não são só
 * enfeite — refletem o que `calculateINSS`/`calculateFatorAjuste` de fato
 * fazem), dando sensação de um diagnóstico técnico sendo processado, em vez
 * do resultado aparecer instantâneo.
 */
export function CalculatingLoader({ onDone }: CalculatingLoaderProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      onDone();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    STAGES.forEach((_, index) => {
      timers.push(setTimeout(() => setActiveIndex(index), index * STEP_DURATION_MS));
    });
    timers.push(setTimeout(onDone, STAGES.length * STEP_DURATION_MS + 250));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in-up py-8 text-center sm:text-left">
      <h3 className="text-lg font-bold text-navy-900">Gerando o seu diagnóstico...</h3>
      <ul className="mx-auto mt-6 max-w-sm space-y-3 sm:mx-0">
        {STAGES.map((label, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={label} className="flex items-center gap-3 text-left text-sm">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                  isDone
                    ? 'border-accent-500 bg-accent-500 text-white'
                    : isActive
                      ? 'border-accent-500'
                      : 'border-navy-200'
                }`}
              >
                {isDone ? (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3" aria-hidden="true">
                    <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent-500" />
                ) : null}
              </span>
              <span className={isDone || isActive ? 'font-medium text-navy-800' : 'text-navy-400'}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
