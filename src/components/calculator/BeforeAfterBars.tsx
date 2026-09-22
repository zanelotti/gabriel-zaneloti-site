import { formatCurrency } from '@/utils/formatters';

interface BarProps {
  label: string;
  value: number;
  widthPercent: number;
  tone: 'neutral' | 'accent';
}

function Bar({ label, value, widthPercent, tone }: BarProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy-500">{label}</span>
        <span className={`text-sm font-bold ${tone === 'accent' ? 'text-accent-700' : 'text-navy-700'}`}>
          {formatCurrency(value)}
        </span>
      </div>
      <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-navy-100">
        <div
          className={`h-full rounded-full ${tone === 'accent' ? 'bg-accent-500' : 'bg-navy-400'}`}
          style={{ width: `${Math.min(100, Math.max(4, widthPercent))}%` }}
        />
      </div>
    </div>
  );
}

interface BeforeAfterBarsProps {
  antes: number;
  depois: number;
}

/**
 * Comparativo visual "antes x depois" — só é exibido quando existe um valor
 * de redução calculado (fluxo normal do ResultCard). Não cita os gatilhos
 * legais específicos, só o fundamento geral (IN RFB nº 2021/2021).
 */
export function BeforeAfterBars({ antes, depois }: BeforeAfterBarsProps) {
  const maxValue = Math.max(antes, depois, 1);

  return (
    <div className="mt-6 rounded-xl2 border border-navy-100 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">Comparativo antes x depois</p>
      <div className="mt-4 space-y-4">
        <Bar
          label="Valor presumido pela Receita Federal"
          value={antes}
          widthPercent={(antes / maxValue) * 100}
          tone="neutral"
        />
        <Bar
          label="Valor estimado após a redução legal"
          value={depois}
          widthPercent={(depois / maxValue) * 100}
          tone="accent"
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-navy-400">
        Seguindo a Instrução Normativa RFB nº 2021/2021, é possível reduzir legalmente o valor do INSS presumido pela
        Receita Federal para a sua obra.
      </p>
    </div>
  );
}
