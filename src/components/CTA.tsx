import { Container } from '@/components/ui/Container';
import { RiskFreeBadge } from '@/components/ui/RiskFreeBadge';
import { BotaoWhatsApp } from '@/components/ui/BotaoWhatsApp';
import { trackEvent } from '@/services/analytics';

export function CTA() {
  return (
    <section className="bg-navy-950 py-20 sm:py-24">
      <Container className="text-center">
        <div className="flex justify-center">
          <RiskFreeBadge variant="dark" />
        </div>

        <h2 className="mt-6 text-3xl font-extrabold text-white sm:text-4xl">
          Veja como reduzir o INSS da sua obra
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-navy-200 sm:text-lg">
          Faça a simulação gratuita e um analista entra em contato pelo WhatsApp para conversar sobre a sua obra — ou
          agende uma consultoria comigo, sem compromisso.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#calculadora"
            className="btn-primary w-full sm:w-auto"
            onClick={() => trackEvent('click_simular', { origem: 'cta_final' })}
          >
            Simular agora
          </a>
          <a
            href="#agendar"
            className="btn text-white bg-white/10 hover:bg-white/20 w-full sm:w-auto"
            onClick={() => trackEvent('click_agendar', { origem: 'cta_final' })}
          >
            Agendar consultoria gratuita
          </a>
          <BotaoWhatsApp origem="cta_final" texto="Chamar no WhatsApp" className="w-full sm:w-auto" />
        </div>
      </Container>
    </section>
  );
}
