import { Container } from '@/components/ui/Container';
import { generateGenericWhatsAppLink } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';

export function Hero() {
  return (
    <section id="inicio" className="relative overflow-hidden bg-navy-950 pb-24 pt-16 sm:pb-32 sm:pt-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 85% 10%, rgba(147,201,58,0.25) 0%, transparent 60%), radial-gradient(50% 40% at 10% 90%, rgba(247,146,15,0.18) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      <Container className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-fade-in-up">
          <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-300">
            Especialista em INSS de Obras
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl lg:text-[3.25rem]">
            Reduza o INSS da sua obra e regularize sua construção com segurança
          </h1>

          <p className="mt-6 max-w-xl text-lg text-navy-100">
            Analiso as características da sua obra e identifico oportunidades legais de redução do INSS, além de
            cuidar do processo de regularização.
          </p>

          <div className="mt-8 inline-flex flex-col items-start gap-1.5 rounded-2xl border border-accent-400/30 bg-white/5 px-5 py-4">
            <span className="text-2xl font-extrabold text-accent-300 sm:text-3xl">Economia de até 70%*</span>
            <span className="text-xs text-navy-200">
              *A economia varia conforme as características, documentação e situação de cada obra.
            </span>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href="#calculadora"
              className="btn-primary"
              onClick={() => trackEvent('click_simular', { origem: 'hero' })}
            >
              Calcular meu INSS
            </a>
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
        </div>

        <div className="relative animate-fade-in lg:justify-self-end">
          <div className="mx-auto max-w-sm rounded-xl2 border border-white/10 bg-white/[0.06] p-6 shadow-card backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent-300">Resultado</p>
            <p className="mt-4 text-sm text-navy-200">INSS estimado antes da análise</p>
            <p className="text-2xl font-bold text-white">R$ 42.180,00</p>

            <div className="my-4 h-px bg-white/10" />

            <p className="text-sm text-navy-200">Valor estimado após redução</p>
            <p className="text-3xl font-extrabold text-accent-300">R$ 16.872,00</p>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent-500/10 px-3 py-2">
              <span className="text-sm font-semibold text-accent-300">Redução estimada de 60%</span>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-navy-300">
              Exemplo ilustrativo. Sua simulação é calculada com base nos dados reais da sua obra.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
