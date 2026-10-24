import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Calculator } from '@/components/calculator/Calculator';
import { trackEvent } from '@/services/analytics';

/** Topo do site: título + a calculadora logo de cara (a primeira coisa que o visitante vê). */
export function Hero() {
  // Depois do cálculo o resultado é largo: o cartão passa a ocupar a linha inteira.
  const [temResultado, setTemResultado] = useState(false);

  return (
    <section id="inicio" className="relative overflow-hidden bg-navy-950 pb-24 pt-10 sm:pb-32 sm:pt-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 85% 10%, rgba(147,201,58,0.25) 0%, transparent 60%), radial-gradient(50% 40% at 10% 90%, rgba(247,146,15,0.18) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <Container
        className={`relative grid gap-8 lg:gap-12 ${temResultado ? '' : 'lg:grid-cols-2 lg:items-start'}`}
      >
        <div className={`animate-fade-in-up ${temResultado ? 'mx-auto max-w-3xl text-center' : 'lg:pr-6 lg:pt-4'}`}>
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            Especialista em INSS de Obras
          </span>

          <h1 className="mt-5 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white sm:mt-7 sm:text-5xl [text-wrap:balance] lg:text-[3.1rem] lg:leading-[1.08]">
            Economize até 70%* no INSS da sua obra
          </h1>

          <p className="mt-4 text-base leading-snug text-navy-200 sm:text-lg [text-wrap:balance]">
            Estratégia baseada na IN RFB 2.021/2021, da Receita Federal.
          </p>

          <p className="mt-3 text-xs leading-relaxed text-navy-300 sm:text-sm">
            *A economia varia conforme as características, documentação e situação de cada obra.
          </p>

          <div className={`mt-8 sm:mt-10 ${temResultado ? 'flex flex-col items-center' : ''}`}>
            <a
              href="#agendar"
              className="btn-primary w-full gap-3 px-8 py-4 text-base shadow-card ring-4 ring-amber-500/25 sm:w-auto"
              onClick={() => trackEvent('click_agendar', { origem: 'hero' })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4M8 3v4M3 10h18" />
              </svg>
              Agendar call gratuita
            </a>
            <p className="mt-3 text-sm text-navy-200">Prefere falar? Marque uma call com o Gabriel.</p>
          </div>
        </div>

        <Calculator embedded onResultChange={setTemResultado} />
      </Container>
    </section>
  );
}
