import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Calculator } from '@/components/calculator/Calculator';
import { trackEvent } from '@/services/analytics';
import { BotaoWhatsApp } from '@/components/ui/BotaoWhatsApp';
import { Provas } from '@/components/Provas';

/** Topo do site: título + a calculadora logo de cara (a primeira coisa que o visitante vê). */
export function Hero() {
  // Depois do cálculo o resultado é largo: o cartão passa a ocupar a linha inteira.
  const [temResultado, setTemResultado] = useState(false);

  // overflow-clip (e não hidden) para o botão "Ver o resultado" poder ficar grudado no rodapé da tela no celular.
  return (
    <section id="inicio" className="relative overflow-hidden supports-[overflow:clip]:overflow-clip bg-navy-950 pb-24 pt-10 sm:pb-32 sm:pt-14">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 85% 10%, rgba(147,201,58,0.25) 0%, transparent 60%), radial-gradient(50% 40% at 10% 90%, rgba(247,146,15,0.18) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <Container
        className={`relative grid grid-cols-1 gap-8 ${
          temResultado ? 'lg:gap-12' : 'lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-6'
        }`}
      >
        {/* No computador: coluna da esquerda = texto, avaliações, botões; direita = calculadora.
            No celular: texto, botões, avaliações e, logo abaixo, a calculadora. */}
        <div
          className={`animate-fade-in-up ${
            temResultado ? 'mx-auto max-w-3xl text-center' : 'lg:col-start-1 lg:row-start-1 lg:pr-6 lg:pt-4'
          }`}
        >
          <span className="hidden items-center rounded-full lg:inline-flex bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            Especialista em INSS de Obras
          </span>

          <h1 className="mt-0 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-white lg:mt-7 sm:text-5xl [text-wrap:balance] lg:text-[3.1rem] lg:leading-[1.08]">
            Economize até 70%* no INSS da sua obra
          </h1>

          <p className="mt-4 hidden text-base leading-snug text-navy-200 sm:text-lg lg:block [text-wrap:balance]">
            Estratégia baseada na IN RFB 2.021/2021, da Receita Federal.
          </p>

          <p className="mt-3 text-xs leading-relaxed text-navy-300 sm:text-sm">
            <span className="lg:hidden">*Varia conforme cada obra.</span>
            <span className="hidden lg:inline">
              *A economia varia conforme as características, documentação e situação de cada obra.
            </span>
          </p>

        </div>

        <div
          className={`animate-fade-in-up ${
            temResultado ? 'mx-auto flex max-w-3xl flex-col items-center text-center' : 'lg:col-start-1 lg:row-start-3 lg:pr-6'
          }`}
        >
          {/* Celular: o botão principal é calcular; agendar e WhatsApp ficam menores, como secundários. */}
          {!temResultado && (
            <div className="lg:hidden">
              <a
                href="#calculadora"
                className="btn-primary w-full gap-3 px-6 py-4 text-base shadow-card ring-4 ring-amber-500/25"
                onClick={() => trackEvent('click_simular', { origem: 'hero_celular' })}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <rect x="4" y="2" width="16" height="20" rx="2" />
                  <path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8" />
                </svg>
                Calcule o INSS da sua obra
              </a>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href="#agendar"
                  className="btn gap-2 border border-white/25 px-3 py-2.5 text-sm text-white hover:bg-white/10"
                  onClick={() => trackEvent('click_agendar', { origem: 'hero_celular' })}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <path d="M16 3v4M8 3v4M3 10h18" />
                  </svg>
                  Agendar call
                </a>
                <BotaoWhatsApp origem="hero" texto="WhatsApp" compacto className="w-full" />
              </div>
            </div>
          )}

          <div className={temResultado ? 'flex flex-col items-center' : 'hidden lg:block'}>
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
            <BotaoWhatsApp origem="hero" texto="Ou chame no WhatsApp" className="mt-3 w-full sm:w-auto" />
            <a
              href="#ebook"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-300 underline-offset-4 hover:underline"
              onClick={() => trackEvent('click_ebook', { origem: 'hero' })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
              </svg>
              Ou baixe o e-book grátis: como reduzir o INSS da obra
            </a>
          </div>
        </div>

        {!temResultado && (
          <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:pr-6">
            {/* min-w-0: o quadro do Trustindex nasce largo antes de carregar o próprio estilo; sem isso ele alargava a coluna
                e o título "pulava" de linha no celular (CLS). */}
            <Provas />
          </div>
        )}

        <div className={temResultado ? 'min-w-0' : 'min-w-0 lg:col-start-2 lg:row-span-3 lg:row-start-1'}>
          <Calculator embedded onResultChange={setTemResultado} />
        </div>
      </Container>
    </section>
  );
}
