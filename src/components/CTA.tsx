import { Container } from '@/components/ui/Container';
import { generateGenericWhatsAppLink } from '@/services/whatsapp';
import { trackEvent } from '@/services/analytics';

export function CTA() {
  return (
    <section className="bg-navy-950 py-20 sm:py-24">
      <Container className="text-center">
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
          Descubra quanto você pode economizar na sua obra
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-navy-200 sm:text-lg">
          Faça uma simulação inicial e descubra se sua obra possui potencial de redução no INSS.
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
            href={generateGenericWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn text-white bg-white/10 hover:bg-white/20 w-full sm:w-auto"
            onClick={() => trackEvent('whatsapp_clicked', { origem: 'cta_final' })}
          >
            Falar pelo WhatsApp
          </a>
        </div>
      </Container>
    </section>
  );
}
