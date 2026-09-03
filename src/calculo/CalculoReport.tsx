import type { FatorAjusteResult } from '@/types/fatorAjuste';
import { formatCurrency, formatPercentPrecise } from '@/utils/formatters';

interface CalculoReportProps {
  result: FatorAjusteResult;
}

function competenciaLabel(competencia: string): string {
  const [year, month] = competencia.split('-');
  return `${month}/${year}`;
}

export function CalculoReport({ result }: CalculoReportProps) {
  return (
    <div className="mt-8 space-y-8">
      <div className="card">
        <h2 className="text-lg font-bold text-navy-900">Dados iniciais</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-navy-400">Área</dt>
            <dd className="font-semibold text-navy-900">{result.areaM2} m²</dd>
          </div>
          <div>
            <dt className="text-navy-400">Fator de Ajuste aplicável</dt>
            <dd className="font-semibold text-navy-900">{result.percentualFator}% da RMT</dd>
          </div>
          <div>
            <dt className="text-navy-400">RMT (100% SERO)</dt>
            <dd className="font-semibold text-navy-900">{formatCurrency(result.rmt100)}</dd>
          </div>
          <div>
            <dt className="text-navy-400">RMT ajustada ({result.percentualFator}%)</dt>
            <dd className="font-semibold text-navy-900">{formatCurrency(result.rmtAjustada)}</dd>
          </div>
          <div>
            <dt className="text-navy-400">Período com DCTFWeb</dt>
            <dd className="font-semibold text-navy-900">
              {competenciaLabel(result.linhasComFator[0].competencia)} até{' '}
              {competenciaLabel(result.linhasComFator[result.linhasComFator.length - 1].competencia)} (
              {result.numeroMeses} meses)
            </dd>
          </div>
        </dl>
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-navy-100">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-navy-800 text-left text-white">
              <th className="px-3 py-2 font-semibold">Mês/Ano</th>
              <th className="px-3 py-2 font-semibold">Rem. Atual</th>
              <th className="px-3 py-2 font-semibold">Rem. Orig.</th>
              <th className="px-3 py-2 font-semibold">CPP</th>
              <th className="px-3 py-2 font-semibold">Multa</th>
              <th className="px-3 py-2 font-semibold">Selic</th>
              <th className="px-3 py-2 font-semibold">Mora</th>
              <th className="px-3 py-2 font-semibold">MAED</th>
              <th className="px-3 py-2 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.linhasComFator.map((linha, index) => (
              <tr key={linha.competencia} className={index % 2 === 0 ? 'bg-white' : 'bg-navy-50'}>
                <td className="px-3 py-2 font-medium text-navy-800">{competenciaLabel(linha.competencia)}</td>
                <td className="px-3 py-2">{formatCurrency(linha.remAtual)}</td>
                <td className="px-3 py-2">{formatCurrency(linha.remOrig)}</td>
                <td className="px-3 py-2">{formatCurrency(linha.cpp)}</td>
                <td className="px-3 py-2">{formatCurrency(linha.multa)}</td>
                <td className="px-3 py-2">{formatPercentPrecise(linha.selicPct)}</td>
                <td className="px-3 py-2">{formatCurrency(linha.mora)}</td>
                <td className="px-3 py-2">{formatCurrency(linha.maed)}</td>
                <td className="px-3 py-2 font-semibold text-navy-900">{formatCurrency(linha.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-navy-900 font-bold text-white">
              <td className="px-3 py-2" colSpan={8}>
                TOTAL (com Fator de Ajuste)
              </td>
              <td className="px-3 py-2">{formatCurrency(result.totalComFator)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs font-semibold uppercase text-navy-400">Sem Fator de Ajuste</p>
          <p className="mt-1 text-xl font-extrabold text-navy-900">{formatCurrency(result.totalSemFator)}</p>
        </div>
        <div className="card border-accent-400 bg-accent-50">
          <p className="text-xs font-semibold uppercase text-navy-400">Com Fator de Ajuste</p>
          <p className="mt-1 text-xl font-extrabold text-accent-700">{formatCurrency(result.totalComFator)}</p>
        </div>
        <div className="card border-accent-400 bg-accent-50">
          <p className="text-xs font-semibold uppercase text-navy-400">Redução</p>
          <p className="mt-1 text-xl font-extrabold text-accent-700">
            {formatCurrency(result.reducao)} / {formatPercentPrecise(result.reducaoPercentual)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase text-navy-400">Parcelamento (estimado)</p>
          <p className="mt-1 text-xl font-extrabold text-navy-900">
            {result.parcelamento.numeroParcelas}x de {formatCurrency(result.parcelamento.valorParcela)}
          </p>
        </div>
      </div>

      {result.honorarios !== null && (
        <div className="card">
          <h2 className="text-lg font-bold text-navy-900">Honorários e redução líquida</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-navy-400">Honorários</dt>
              <dd className="font-semibold text-navy-900">{formatCurrency(result.honorarios)}</dd>
            </div>
            <div>
              <dt className="text-navy-400">Redução líquida</dt>
              <dd className="font-semibold text-navy-900">{formatCurrency(result.reducaoLiquida ?? 0)}</dd>
            </div>
          </dl>
        </div>
      )}

      <p className="text-xs leading-relaxed text-navy-400">
        Cálculo interno de apoio, baseado na mecânica da IN RFB nº 2021/2021 (Fator de Ajuste) e na tabela de Selic
        mensal mantida no projeto. O valor "sem Fator de Ajuste" usa a taxa de referência fixa de 36,8% sobre a
        RMT (100%). O parcelamento é uma estimativa simples (total ÷ nº de parcelas, respeitando parcela mínima de
        R$200 para PF e R$500 para PJ, até 60x) e não inclui os juros próprios do parcelamento da Receita Federal.
        Esta simulação não substitui a apuração oficial feita pelo Sero/DCTFWeb.
      </p>
    </div>
  );
}
