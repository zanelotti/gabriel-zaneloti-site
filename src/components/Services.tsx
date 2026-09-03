import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ServiceCard } from './ServiceCard';
import { SERVICES } from '@/data/services';
import { trackEvent } from '@/services/analytics';

export function Services() {
  return (
    <section id="servicos" className="scroll-mt-20 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="O que eu faço"
          title="Serviços especializados em INSS de obras"
          description="Cuido de todo o processo de análise, redução e regularização, do cadastro à emissão da CND."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="#calculadora"
            className="btn-primary"
            onClick={() => trackEvent('click_simular', { origem: 'services' })}
          >
            Fazer simulação
          </a>
        </div>
      </Container>
    </section>
  );
}
