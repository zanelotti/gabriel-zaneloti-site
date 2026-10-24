import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { RiskFreeBadge } from '@/components/ui/RiskFreeBadge';
import { Calculator } from '@/components/calculator/Calculator';
import { generateGenericWhatsAppLink } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';

/** Topo do site: título + a calculadora logo de cara (a primeira coisa que o visitante vê). */
export function Hero() {
  // Depois do cálculo o resultado é largo: o cartão passa a ocupar a linha inteira.
  const [temResultado, setTemResultado] = useState(false);

  return (
    <section id="inicio" className="relative overflow-hidden bg-navy-950 pb-24 pt-8 sm:pb-28 sm:pt-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 85% 10%, rgba(147,201,58,0.25) 0%, transparent 60%), radial-gradient(50% 40% at 10% 90%, rgba(247,146,15,0.18) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <Container
        className={`relative grid gap-8 lg:gap-12 ${temResultado ? '' : 'lg:grid-cols-[1fr_1.05fr] lg:items-start'}`}
      >
        <div className={`animate-fade-in-up ${temResultado ? 'mx-auto max-w-3xl text-center' : ''}`}>
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            Especialista em INSS de Obras
          </span>

          <h1 className="mt-4 text-[1.65rem] font-extrabold leading-[1.15] text-white sm:mt-6 sm:text-4xl lg:text-[2.4rem]">
            Economize até 70%* no INSS da sua Obra utilizando a nossa estratégia de acordo com a IN RFB 2.021/2021
            da Receita Federal!
          </h1>

          <p className="mt-3 text-xs text-navy-300 sm:mt-4">
            *A economia varia conforme as características, documentação e situação de cada obra.
          </p>

          <p className="mt-5 hidden max-w-xl text-lg text-navy-100 sm:block">
            Analiso as características da sua obra e identifico oportunidades de redução do INSS, além de cuidar do
            processo de regularização.
          </p>

          <div className={`mt-6 hidden flex-col gap-3 sm:mt-8 sm:flex sm:flex-row ${temResultado ? 'sm:justify-center' : ''}`}>
            <a
              href={generateGenericWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-white bg-white/10 hover:bg-white/20"
              onClick={() => trackEvent('whatsapp_clicked', { origem: 'hero' })}
            >
              Falar com Gabriel
            </a>
          </div>

          <RiskFreeBadge variant="dark" className="mt-6 hidden lg:inline-flex" />
        </div>

        <Calculator embedded onResultChange={setTemResultado} />
      </Container>
    </section>
  );
}
