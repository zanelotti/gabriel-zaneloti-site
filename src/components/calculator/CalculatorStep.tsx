import type { PropsWithChildren } from 'react';

interface CalculatorStepProps {
  title: string;
  description?: string;
}

/** Shell visual reutilizado por cada etapa da calculadora (título + descrição + campos). */
export function CalculatorStep({ title, description, children }: PropsWithChildren<CalculatorStepProps>) {
  return (
    <div className="animate-fade-in-up">
      <h3 className="text-xl font-bold text-navy-900 sm:text-2xl">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-navy-500 sm:text-base">{description}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}
