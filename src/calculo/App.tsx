import { useState } from 'react';
import { PasscodeGate } from './PasscodeGate';
import { CalculoForm } from './CalculoForm';
import { CalculoReport } from './CalculoReport';
import { calculateFatorAjuste } from '@/services/calculateFatorAjuste';
import type { FatorAjusteInput, FatorAjusteResult } from '@/types/fatorAjuste';

/**
 * eSocial só passou a ser obrigatório para o envio de informações da obra a
 * partir da competência 10/2021 — antes disso, a apuração era pelo GFIP.
 * Mesma regra já aplicada no simulador público (`calculateINSS.ts`): se a
 * obra começou antes de 10/2021, o CÁLCULO considera o início a partir de
 * 10/2021, para poder tramitar tudo já pelo eSocial. A data real de início
 * informada no formulário não muda — só a competência usada no motor de
 * cálculo.
 */
const CORTE_ESOCIAL = '2021-10-01';

/** Maior das duas datas ISO ("AAAA-MM-DD"), como string. */
function maxISODate(a: string, b: string): string {
  return a > b ? a : b;
}

export default function App() {
  const [result, setResult] = useState<FatorAjusteResult | null>(null);
  const [error, setError] = useState('');
  const [dataInicioReal, setDataInicioReal] = useState('');
  const [dataInicioAjustada, setDataInicioAjustada] = useState<string | null>(null);

  const handleSubmit = (input: FatorAjusteInput) => {
    setError('');
    try {
      const dataInicioCalculo = maxISODate(input.dataInicio, CORTE_ESOCIAL);
      const dataFimCalculo = maxISODate(dataInicioCalculo, input.dataFim);

      const calculado = calculateFatorAjuste({
        ...input,
        dataInicio: dataInicioCalculo,
        dataFim: dataFimCalculo,
      });

      setDataInicioReal(input.dataInicio);
      setDataInicioAjustada(dataInicioCalculo !== input.dataInicio ? dataInicioCalculo : null);
      setResult(calculado);
    } catch (err) {
      setResult(null);
      setDataInicioAjustada(null);
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

          {result && (
            <CalculoReport
              result={result}
              dataInicioReal={dataInicioReal}
              dataInicioAjustada={dataInicioAjustada}
            />
          )}
        </div>
      </div>
    </PasscodeGate>
  );
}
