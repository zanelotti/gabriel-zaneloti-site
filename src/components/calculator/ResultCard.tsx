import { useEffect } from 'react';
import type { CalculatorData, INSSResult } from '@/types/calculator';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { generateWhatsAppMessage } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';

interface ResultCardProps {
  data: CalculatorData;
  result: INSSResult;
  onReset: () => void;
}

interface StatCardProps {
  label: string;
  value: number;
  format: 'currency' | 'percent';
  tone: 'neutral' | 'highlight';
}

function StatCard({ label, value, format, tone }: StatCardProps) {
  const animated = useCountUp(value, 1000);
  const display = format === 'currency' ? formatCurrency(animated) : formatPercent(animated);

  return (
    <div
      className={`rounded-xl2 border p-5 text-center sm:text-left ${
        tone === 'highlight' ? 'border-accent-400 bg-accent-50' : 'border-navy-100 bg-white'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold sm:text-3xl ${tone === 'highlight' ? 'text-accent-700' : 'text-navy-900'}`}>
        {display}
      </p>
    </div>
  );
}

/** Tela de resultado exibida após o envio da etapa 3 da calculadora. */
export function ResultCard({ data, result, onReset }: ResultCardProps) {
  useEffect(() => {
    const el = document.getElementById('resultado-simulacao');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const whatsappUrl = generateWhatsAppMessage(data, result);

  return (
    <div id="resultado-simulacao" className="animate-fade-in-up scroll-mt-24">
      <h3 className="text-xl font-bold text-navy-900 sm:text-2xl">Veja uma estimativa do seu INSS de obra</h3>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="INSS estimado antes da análise" value={result.inssEstimado} format="currency" tone="neutral" />
        <StatCard label="Economia estimada" value={result.economiaEstimada} format="currency" tone="highlight" />
        <StatCard label="Redução estimada" value={result.percentualReducao} format="percent" tone="highlight" />
        <StatCard
          label="Valor estimado após redução"
          value={result.valorAposReducao}
          format="currency"
          tone="neutral"
        />
      </div>

      <p className="mt-5 rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-600">
        <strong className="text-navy-800">Importante:</strong> este resultado é uma estimativa inicial e não
        substitui uma análise técnica e tributária da documentação da obra.
      </p>

      <div className="mt-8 rounded-xl2 border border-navy-100 bg-white p-6 text-center sm:text-left">
        <h4 className="text-lg font-bold text-navy-900">Existe possibilidade de reduzir esse valor?</h4>
        <p className="mt-2 text-sm text-navy-500">
          Uma análise especializada pode identificar possibilidades legais de redução aplicáveis às características
          da sua obra.
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-5 w-full sm:w-auto"
          onClick={() => trackEvent('whatsapp_clicked', { origem: 'resultado' })}
        >
          Quero analisar minha obra no WhatsApp
        </a>
      </div>

      <button type="button" onClick={onReset} className="mt-5 text-sm font-semibold text-navy-500 underline">
        Fazer uma nova simulação
      </button>
    </div>
  );
}
