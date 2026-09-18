import { useState } from 'react';

export interface MonthlyDatum {
  /** Rótulo curto do mês, ex: "jan/26". */
  label: string;
  value: number;
}

interface MonthlyColumnChartProps {
  data: MonthlyDatum[];
}

/**
 * Gráfico de colunas simples (leads por mês). SVG puro, coluna fina com
 * topo arredondado, tooltip via hover state (mais preciso que o `title`
 * nativo do navegador, que atrasa pra aparecer).
 */
export function MonthlyColumnChart({ data }: MonthlyColumnChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-navy-400">Sem dados ainda.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 640;
  const height = 180;
  const paddingBottom = 24;
  const barGap = 10;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Leads por mês">
        {data.map((datum, index) => {
          const barHeight = Math.max((datum.value / max) * (height - paddingBottom - 20), datum.value > 0 ? 4 : 0);
          const x = index * (barWidth + barGap);
          const y = height - paddingBottom - barHeight;
          const isHovered = hoverIndex === index;

          return (
            <g key={datum.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                className={isHovered ? 'fill-navy-700' : 'fill-navy-400'}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              />
              {isHovered && (
                <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" className="fill-navy-900 text-[11px] font-bold">
                  {datum.value}
                </text>
              )}
              <text
                x={x + barWidth / 2}
                y={height - 6}
                textAnchor="middle"
                className="fill-navy-400 text-[10px] font-medium"
              >
                {datum.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
