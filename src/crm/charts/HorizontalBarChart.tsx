export interface HorizontalBarDatum {
  label: string;
  value: number;
  /** Classe Tailwind de fundo para a barra, ex: 'bg-navy-500'. */
  colorClass: string;
  /** Texto opcional mostrado à direita da barra (ex: valor formatado). Default: o `value`. */
  valueLabel?: string;
}

interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  emptyMessage?: string;
}

/**
 * Gráfico de barras horizontais simples, em HTML/CSS puro (sem lib de
 * gráficos). Barra fina, ponta arredondada, rótulo direto no lado — sem
 * eixo, que não agrega nada com poucas categorias como essas.
 */
export function HorizontalBarChart({ data, emptyMessage = 'Sem dados ainda.' }: HorizontalBarChartProps) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-navy-400">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-3">
      {data.map((datum) => (
        <div key={datum.label} className="flex items-center gap-3">
          <p className="w-28 shrink-0 truncate text-sm font-medium text-navy-600" title={datum.label}>
            {datum.label}
          </p>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-navy-50">
            <div
              className={`h-full rounded-full ${datum.colorClass} transition-[width]`}
              style={{ width: `${Math.max((datum.value / max) * 100, datum.value > 0 ? 3 : 0)}%` }}
              title={`${datum.label}: ${datum.valueLabel ?? datum.value}`}
            />
          </div>
          <p className="w-14 shrink-0 text-right text-sm font-bold text-navy-800">
            {datum.valueLabel ?? datum.value}
          </p>
        </div>
      ))}
    </div>
  );
}
