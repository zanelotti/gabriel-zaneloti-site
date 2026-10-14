import { useEffect, type ReactNode } from 'react';
import type { CalculatorData, INSSResult } from '@/types/calculator';
import { useCountUp } from '@/hooks/useCountUp';
import { formatArea, formatCurrency, formatDateBR, formatPercent } from '@/utils/formatters';
import { generateWhatsAppMessage } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';
import { downloadLeadPdf } from '@/services/pdfReport';
import { PRINTS } from '@/components/Depoimentos';
import { BeforeAfterBars } from './BeforeAfterBars';
import { PostSaleTimeline } from './PostSaleTimeline';
import { AgendarNoResultado } from './AgendarNoResultado';
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

/** Valor em reais com contagem animada (sobe de zero até o valor final). */
function ValorAnimado({ value, className }: { value: number; className: string }) {
  const animated = useCountUp(value, 1000);
  return <p className={className}>{formatCurrency(animated)}</p>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-navy-800">{value}</p>
    </div>
  );
}

/** Resumo (somente leitura) dos dados que o próprio lead preencheu na calculadora — fica recolhido por padrão. */
function DataSummary({ data }: { data: CalculatorData }) {
  return (
    <details className="group mt-6 rounded-xl2 border border-navy-100 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-bold text-navy-900 [&::-webkit-details-marker]:hidden">
        Ver dados da simulação
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true">
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="border-t border-navy-100 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
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
    </details>
  );
}

function Diferencial({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
        {icone}
      </span>
      <div>
        <p className="text-sm font-bold text-navy-900">{titulo}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-navy-500">{texto}</p>
      </div>
    </li>
  );
}

const ICONE = 'h-5 w-5';

/** Diferenciais + prova social (prints reais de clientes, os mesmos da seção "Depoimentos"). */
function ConfiancaESocial() {
  return (
    <div className="mt-6 rounded-xl2 border border-navy-100 bg-white p-5 sm:p-6">
      <ul className="space-y-5">
        <Diferencial
          icone={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={ICONE} aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
            </svg>
          }
          titulo="Atendo obras de todo o Brasil"
          texto="100% online. Você não precisa sair de casa nem ir a escritório."
        />
        <Diferencial
          icone={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={ICONE} aria-hidden="true">
              <path d="M19 5 5 19" />
              <circle cx="7" cy="7" r="2.2" />
              <circle cx="17" cy="17" r="2.2" />
            </svg>
          }
          titulo="Honorários calculados sobre a economia"
          texto="Meu honorário é uma porcentagem da economia comprovada na sua obra."
        />
        <Diferencial
          icone={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={ICONE} aria-hidden="true">
              <path d="m3 17 6-6 4 4 8-8" />
              <path d="M15 7h6v6" />
            </svg>
          }
          titulo="+R$ 1 milhão já economizado"
          texto="Por clientes que regularizaram a obra comigo."
        />
      </ul>

      <div className="mt-6 border-t border-navy-100 pt-5">
        <p className="section-eyebrow">Quem já regularizou</p>
        <div className="-mx-1 mt-3 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
          {PRINTS.map((print) => (
            <a
              key={print.arquivo}
              href={`/depoimentos/${print.arquivo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 snap-start overflow-hidden rounded-xl border border-navy-100 bg-navy-50"
            >
              <img
                src={`/depoimentos/${print.arquivo}`}
                alt={print.alt}
                width={print.largura}
                height={print.altura}
                loading="lazy"
                className="block h-56 w-auto max-w-none"
              />
            </a>
          ))}
        </div>
        <p className="mt-1 text-xs text-navy-400">Mensagens reais de clientes, com os dados ocultados. Toque para ampliar.</p>
      </div>
    </div>
  );
}

function primeiroNome(nome: string): string {
  const parte = nome.trim().split(/\s+/)[0] ?? '';
  if (!parte) return '';
  return parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1).toLocaleLowerCase('pt-BR');
}

/** Tela de resultado exibida após o envio da etapa 3 da calculadora. */
export function ResultCard({ data, result, onReset }: ResultCardProps) {
  useEffect(() => {
    const el = document.getElementById('resultado-simulacao');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const whatsappUrl = generateWhatsAppMessage(data, result);
  const nome = primeiroNome(data.nome);

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
  const fluxoNormal = !fatorAjusteNaoAplicavel && !exigeAnaliseManual;
  const temEconomia = fluxoNormal && result.economiaEstimada > 0;

  const tituloAgenda = fatorAjusteNaoAplicavel
    ? 'Vamos identificar a melhor estratégia para sua empresa'
    : exigeAnaliseManual
      ? 'Vamos analisar sua obra com atenção'
      : temEconomia
        ? 'Confirme essa economia em 10 minutos'
        : 'Vamos analisar sua obra em 10 minutos';
  const textoAgenda = fatorAjusteNaoAplicavel
    ? 'Cada empresa tem particularidades (regime tributário, CNAE, contabilidade) que mudam a estratégia de redução. Escolha um horário e eu analiso o seu caso com você — sem custo e sem compromisso.'
    : exigeAnaliseManual
      ? 'Obras iniciadas antes de outubro de 2021 têm regras próprias de apuração. Escolha um horário e eu faço a simulação completa com você — sem custo e sem compromisso.'
      : 'Escolha um horário. Eu analiso sua obra com você e mostro quanto dá pra reduzir de verdade — sem custo e sem compromisso.';

  // Resumo curto que vai junto no agendamento (aparece no evento da agenda e no e-mail do Gabriel).
  const resumoObra = [
    `Simulação no site: ${RESPONSAVEL_LABEL[data.responsavel] ?? '—'}`,
    DESTINACAO_LABEL[data.destinacao],
    data.areaPrincipal ? formatArea(data.areaPrincipal) : null,
    data.estado ? estadoLabel(data.estado) : null,
  ]
    .filter(Boolean)
    .join(' · ')
    .concat(
      fluxoNormal
        ? `. INSS presumido ${formatCurrency(result.inssEstimado)}; após redução ${formatCurrency(result.valorAposReducao)}; economia ${formatCurrency(result.economiaEstimada)}.`
        : `. INSS estimado ${formatCurrency(result.inssEstimado)}.`
    );

  return (
    <div id="resultado-simulacao" className="animate-fade-in-up scroll-mt-24">
      {/* 1. Resultado em destaque */}
      <div className="rounded-xl2 border border-navy-100 bg-white p-5 sm:p-6">
        <p className="section-eyebrow">{exigeAnaliseManual ? 'Dados recebidos' : 'Resultado da sua simulação'}</p>

        {fatorAjusteNaoAplicavel ? (
          <>
            <h3 className="mt-2 text-xl font-bold text-navy-900 sm:text-2xl">
              {nome ? `${nome}, veja o ponto de partida da sua obra:` : 'Veja o ponto de partida da sua obra:'}
            </h3>
            <div className="mt-4 rounded-xl2 border border-navy-100 bg-navy-50/60 px-4 py-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">INSS pela aferição indireta</p>
              <ValorAnimado value={result.inssEstimado} className="mt-1 text-3xl font-extrabold text-navy-900 sm:text-4xl" />
            </div>
            <p className="mt-4 rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-600">
              <strong className="text-navy-800">O Fator de Ajuste só se aplica a obras de Pessoa Física.</strong> Para
              Pessoa Jurídica, existem outras formas de buscar economia — como contabilidade regular, desoneração da
              folha (CPRB), Simples Nacional ou créditos abatíveis — mas isso depende de muitas variáveis específicas da
              sua empresa.
            </p>
          </>
        ) : exigeAnaliseManual ? (
          <>
            <h3 className="mt-2 text-xl font-bold text-navy-900 sm:text-2xl">
              {nome ? `${nome}, recebemos os dados da sua obra` : 'Recebemos os dados da sua obra'}
            </h3>
            <div className="mt-4 rounded-xl2 border border-navy-100 bg-navy-50/60 px-4 py-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">INSS devido estimado (sem redução)</p>
              <ValorAnimado value={result.inssEstimado} className="mt-1 text-3xl font-extrabold text-navy-900 sm:text-4xl" />
            </div>
            <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-navy-600">
              <strong className="text-navy-800">Sua obra começou antes de outubro de 2021</strong> — período em que a
              apuração seguia regras diferentes (GFIP) e o cálculo de possíveis reduções é mais complexo, exigindo uma
              análise manual detalhada.
            </p>
          </>
        ) : temEconomia ? (
          <>
            <h3 className="mt-2 text-xl font-bold text-navy-900 sm:text-2xl">
              {nome ? `${nome}, sua obra pode economizar:` : 'Sua obra pode economizar:'}
            </h3>
            <div className="mt-4 rounded-xl2 border border-accent-400 bg-accent-50 px-4 py-6 text-center">
              <ValorAnimado value={result.economiaEstimada} className="text-4xl font-extrabold text-accent-700 sm:text-5xl" />
              <p className="mt-1 text-sm font-semibold text-accent-800">
                {formatPercent(result.percentualReducao)} a menos de INSS na sua obra
              </p>
            </div>
            <BeforeAfterBars compact antes={result.inssEstimado} depois={result.valorAposReducao} />
            {result.parcelamento?.aplicavel && (
              <p className="mt-3 text-xs font-medium text-navy-500">
                Pode ser parcelado em até {result.parcelamento.numeroParcelas}x de{' '}
                {formatCurrency(result.parcelamento.valorParcela)}
              </p>
            )}
            {calculoAjustadoEsocial && (
              <p className="mt-4 rounded-xl bg-navy-50 p-4 text-xs leading-relaxed text-navy-500">
                Sua obra começou entre janeiro e setembro de 2021: o cálculo acima já considera a obrigatoriedade do
                eSocial a partir de outubro de 2021 para obras desse período.
              </p>
            )}
          </>
        ) : (
          <>
            <h3 className="mt-2 text-xl font-bold text-navy-900 sm:text-2xl">
              {nome ? `${nome}, veja a estimativa da sua obra:` : 'Veja a estimativa da sua obra:'}
            </h3>
            <div className="mt-4 rounded-xl2 border border-navy-100 bg-navy-50/60 px-4 py-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">INSS estimado</p>
              <ValorAnimado value={result.inssEstimado} className="mt-1 text-3xl font-extrabold text-navy-900 sm:text-4xl" />
              <p className="mt-1 text-sm text-navy-500">
                Uma análise detalhada pode identificar reduções adicionais para a sua obra.
              </p>
            </div>
          </>
        )}
      </div>

      {/* 2. Próximo passo: agendar a análise gratuita (mesmo sistema da seção "Agendar") */}
      <AgendarNoResultado
        nome={data.nome}
        whatsapp={data.whatsapp}
        resumoObra={resumoObra}
        titulo={tituloAgenda}
        texto={textoAgenda}
        whatsappUrl={whatsappUrl}
      />

      {/* 3. Diferenciais e prova social */}
      <ConfiancaESocial />

      {/* 4. Conversar agora / guardar o diagnóstico em PDF */}
      <div className="mt-6 rounded-xl2 border border-navy-100 bg-white p-5 sm:p-6">
        <h4 className="text-lg font-bold text-navy-900">Ficou com alguma dúvida?</h4>
        <p className="mt-1.5 text-sm text-navy-500">
          Me chame no WhatsApp que eu tiro as suas dúvidas. Você também pode baixar o diagnóstico em PDF para guardar.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full sm:w-auto"
            onClick={() => trackEvent('whatsapp_clicked', { origem: 'resultado' })}
          >
            Quero conversar pelo WhatsApp
          </a>
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
        </div>
      </div>

      {/* 5. O que acontece depois */}
      <PostSaleTimeline />

      {/* 6. Dados da simulação (recolhido) */}
      <DataSummary data={data} />

      <p className="mt-5 text-center text-xs leading-relaxed text-navy-400">
        Estimativa inicial. Não substitui a análise técnica e tributária da documentação da obra.
      </p>

      <div className="mt-4 text-center">
        <button type="button" onClick={onReset} className="text-sm font-semibold text-navy-500 underline">
          Fazer uma nova simulação
        </button>
      </div>
    </div>
  );
}
