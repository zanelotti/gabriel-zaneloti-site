import { useState } from 'react';
import { PasscodeGate } from './PasscodeGate';
import { CalculoForm } from './CalculoForm';
import { CalculoReport } from './CalculoReport';
import { calculateFatorAjuste } from '@/services/calculateFatorAjuste';
import type { FatorAjusteInput, FatorAjusteResult } from '@/types/fatorAjuste';

export default function App() {
  const [result, setResult] = useState<FatorAjusteResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (input: FatorAjusteInput) => {
    setError('');
    try {
      const calculado = calculateFatorAjuste(input);
      setResult(calculado);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Não foi possível calcular. Confira os dados informados.');
    }
  };

  return (
    <PasscodeGate>
      <div className="min-h-screen bg-navy-50 px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8">
            <h1 className="text-2xl font-extrabold text-navy-900">
              Cálculo interno — Fator de Ajuste (INSS de Obra)
            </h1>
            <p className="mt-1 text-sm text-navy-500">
              Ferramenta de uso interno. Informe a RMT (100% SERO) já apurada e os dados da obra para gerar o
              comparativo com e sem o Fator de Ajuste.
            </p>
          </header>

          <CalculoForm onSubmit={handleSubmit} />

          {error && (
            <p className="field-error mt-4" role="alert">
              {error}
            </p>
          )}

          {result && <CalculoReport result={result} />}
        </div>
      </div>
    </PasscodeGate>
  );
}
