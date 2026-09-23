import { useEffect } from 'react';
import type { CalculatorData, INSSResult } from '@/types/calculator';
import { useCountUp } from '@/hooks/useCountUp';
import { formatArea, formatCurrency, formatDateBR, formatPercent } from '@/utils/formatters';
import { generateWhatsAppMessage } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';
import { downloadLeadPdf } from '@/services/pdfReport';
import { BeforeAfterBars } from './BeforeAfterBars';
import { PostSaleTimeline } from './PostSaleTimeline';
import {
  CATEGORIA_LABEL,
  DESTINACAO_LABEL,
  RESPONSAVEL_LABEL,
  SITUACAO_LABEL,
  TIPO_OBRA_LABEL,
  estadoLabel,
} from '@/utils/labels';

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
  /** Nota curta opcional, exibida abaixo do valor (ex: informação de parcelamento). */
  note?: string;
}

function StatCard({ label, value, format, tone, note }: StatCardProps) {
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
      {note && <p className="mt-1 text-xs font-medium text-navy-500">{note}</p>}
    </div>
  );
}

/** Variante do StatCard para um valor textual (ex: "Não aplicável"), sem contador animado. */
function TextStatCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl2 border border-navy-100 bg-white p-5 text-center sm:text-left">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-navy-400 sm:text-3xl">{text}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy-800">{value}</p>
    </div>
  );
}

/** Resumo (somente leitura) dos dados que o próprio lead preencheu na calculadora. */
function DataSummary({ data }: { data: CalculatorData }) {
  return (
    <div className="mt-6 rounded-xl2 border border-navy-100 bg-navy-50/60 p-5">
      <p className="section-eyebrow">Resumo da sua simulação</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem label="Nome" value={data.nome || 'Não informado'} />
        <SummaryItem label="WhatsApp" value={data.whatsapp || 'Não informado'} />
        <SummaryItem label="Responsável" value={RESPONSAVEL_LABEL[data.responsavel] ?? 'Não informado'} />
        <SummaryItem label="Início da obra" value={formatDateBR(data.dataInicio)} />
        <SummaryItem label="Fim da obra" value={data.dataFim ? formatDateBR(data.dataFim) : 'Obra em andamento'} />
        <SummaryItem label="Situação da obra" value={SITUACAO_LABEL[data.situacao] ?? 'Não informado'} />
        <SummaryItem label="Categoria da obra" value={CATEGORIA_LABEL[data.categoria] ?? 'Não informado'} />
        <SummaryItem label="Tipo construtivo" value={TIPO_OBRA_LABEL[data.tipoObra] ?? 'Não informado'} />
        <SummaryItem label="Destinação" value={DESTINACAO_LABEL[data.destinacao] ?? 'Não informado'} />
        <SummaryItem label="Estado" value={estadoLabel(data.estado)} />
        <SummaryItem label="Área principal" value={formatArea(data.areaPrincipal)} />
        <SummaryItem label="Área complementar (piscina etc.)" value={formatArea(data.areaPiscina)} />
      </div>
      {data.observacoes && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">Observações</p>
          <p className="mt-0.5 text-sm text-navy-700">{data.observacoes}</p>
        </div>
      )}
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

  // O Fator de Ajuste (a redução calculada abaixo) só se aplica a obras de
  // Pessoa Física (IN RFB nº 2.021/2021, art. 33) — para Pessoa Jurídica ele
  // simplesmente não existe; a economia de uma PJ vem de outras frentes
  // (contabilidade regular, CPRB/Simples Nacional, créditos abatíveis etc.),
  // que dependem de muitas variáveis da empresa e por isso não são calculadas
  // automaticamente aqui. Essa checagem tem prioridade sobre as outras porque,
  // sendo PJ, o Fator de Ajuste não se aplica independentemente da data da obra.
  const fatorAjusteNaoAplicavel = data.responsavel === 'PJ';
  // Obra iniciada em 2020 ou antes: apuração pelo GFIP, mais complexa e sujeita
  // a decadência caso a caso — não exibimos o cálculo automático de redução
  // para o visitante, só o valor de INSS devido (sem desconto) e o convite
  // para falar direto com o Gabriel.
  const exigeAnaliseManual = !fatorAjusteNaoAplicavel && result.regimeApuracao === 'gfip_anterior_2021';
  // Obra iniciada entre 01/2021 e 09/2021: o cálculo abaixo já foi deslocado
  // internamente para a competência 10/2021 (eSocial) — ver calculateINSS.ts.
  const calculoAjustadoEsocial = !fatorAjusteNaoAplicavel && result.regimeApuracao === 'esocial_ajustado';

  return (
    <div id="resultado-simulacao" className="animate-fade-in-up scroll-mt-24">
      <h3 className="text-xl font-bold text-navy-900 sm:text-2xl">
        {exigeAnaliseManual ? 'Recebemos os dados da sua obra' : 'Veja uma estimativa do seu INSS de obra'}
      </h3>

      <DataSummary data={data} />

      {fatorAjusteNaoAplicavel ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="INSS pela aferição indireta"
              value={result.inssEstimado}
              format="currency"
              tone="neutral"
            />
            <TextStatCard label="INSS pelo fator de ajuste" text="Não aplicável" />
          </div>
          <p className="mt-5 rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-600">
            <strong className="text-navy-800">O Fator de Ajuste só se aplica a obras de Pessoa Física.</strong> Para
            Pessoa Jurídica, existem outras formas de buscar economia — como contabilidade regular, desoneração
            da folha (CPRB), Simples Nacional ou créditos abatíveis — mas isso depende de muitas variáveis específicas
            da sua empresa. Fale comigo no WhatsApp para analisarmos o seu caso.
          </p>
        </>
      ) : exigeAnaliseManual ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="INSS devido estimado (sem redução)"
              value={result.inssEstimado}
              format="currency"
              tone="neutral"
            />
          </div>
          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-navy-600">
            <strong className="text-navy-800">Sua obra começou antes de outubro de 2021</strong> — período em que a
            apuração seguia regras diferentes (GFIP) e o cálculo de possíveis reduções é mais complexo, exigindo uma
            análise manual detalhada. Fale comigo no WhatsApp para simularmos o valor completo com precisão.
          </p>
        </>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <StatCard label="INSS estimado antes da análise" value={result.inssEstimado} format="currency" tone="neutral" />
            <StatCard
              label="Valor estimado após redução"
              value={result.valorAposReducao}
              format="currency"
              tone="neutral"
              note={
                result.parcelamento?.aplicavel
                  ? `Podendo ser parcelado em até ${result.parcelamento.numeroParcelas}x de ${formatCurrency(
                      result.parcelamento.valorParcela
                    )}`
                  : undefined
              }
            />
            <StatCard label="Redução estimada" value={result.percentualReducao} format="percent" tone="highlight" />
            <StatCard label="Economia estimada" value={result.economiaEstimada} format="currency" tone="highlight" />
          </div>

          <BeforeAfterBars antes={result.inssEstimado} depois={result.valorAposReducao} />

          {calculoAjustadoEsocial && (
            <p className="mt-4 rounded-xl bg-navy-50 p-4 text-xs leading-relaxed text-navy-500">
              Sua obra começou entre janeiro e setembro de 2021: o cálculo acima já considera a obrigatoriedade do
              eSocial a partir de outubro de 2021 para obras desse período.
            </p>
          )}

          <p className="mt-5 rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-600">
            <strong className="text-navy-800">Importante:</strong> este resultado é uma estimativa inicial e não
            substitui uma análise técnica e tributária da documentação da obra.
          </p>
        </>
      )}

      <div className="mt-8 rounded-xl2 border border-navy-100 bg-white p-6 text-center sm:text-left">
        <h4 className="text-lg font-bold text-navy-900">
          {fatorAjusteNaoAplicavel
            ? 'Vamos identificar a melhor estratégia para sua empresa?'
            : exigeAnaliseManual
              ? 'Vamos analisar sua obra com atenção'
              : 'Vamos confirmar essa economia com uma análise completa?'}
        </h4>
        <p className="mt-2 text-sm text-navy-500">
          {fatorAjusteNaoAplicavel
            ? 'Cada empresa tem particularidades (regime tributário, CNAE, contabilidade) que mudam completamente a estratégia de redução — por isso essa análise é feita diretamente comigo, sem compromisso.'
            : exigeAnaliseManual
              ? 'Obras iniciadas antes de outubro de 2021 têm regras próprias de apuração — fale comigo para uma simulação precisa, sem compromisso.'
              : 'Uma análise especializada confirma o valor exato dessa economia e pode identificar reduções adicionais aplicáveis às características da sua obra.'}
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-5 w-full sm:w-auto"
          onClick={() => trackEvent('whatsapp_clicked', { origem: 'resultado' })}
        >
          {fatorAjusteNaoAplicavel || exigeAnaliseManual ? 'Falar com Gabriel no WhatsApp' : 'Quero analisar minha obra no WhatsApp'}
        </a>
      </div>

      <PostSaleTimeline />

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => {
            trackEvent('pdf_baixado', { origem: 'resultado' });
            void downloadLeadPdf(data, result);
          }}
          className="btn-outline w-full sm:w-auto"
        >
          Baixar diagnóstico em PDF
        </button>
        <button type="button" onClick={onReset} className="text-sm font-semibold text-navy-500 underline">
          Fazer uma nova simulação
        </button>
      </div>
    </div>
  );
}
