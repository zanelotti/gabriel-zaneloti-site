import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Calculator } from '@/components/calculator/Calculator';

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
        className={`relative grid gap-8 lg:gap-12 ${temResultado ? '' : 'lg:grid-cols-2 lg:items-center'}`}
      >
        <div className={`animate-fade-in-up ${temResultado ? 'mx-auto max-w-3xl text-center' : 'lg:pr-6'}`}>
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            Especialista em INSS de Obras
          </span>

          <h1 className="mt-5 text-[1.65rem] font-extrabold leading-[1.2] tracking-tight text-white sm:mt-7 sm:text-4xl [text-wrap:balance] lg:text-[2.35rem] lg:leading-[1.22]">
            Economize até 70%* no INSS da sua Obra utilizando a nossa estratégia de acordo com a IN RFB 2.021/2021
            da Receita Federal!
          </h1>

          <p className="mt-5 text-xs leading-relaxed text-navy-300 sm:mt-6 sm:text-sm">
            *A economia varia conforme as características, documentação e situação de cada obra.
          </p>
        </div>

        <Calculator embedded onResultChange={setTemResultado} />
      </Container>
    </section>
  );
}
