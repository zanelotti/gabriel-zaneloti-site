import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { BENEFITS } from '@/data/benefits';

export function Benefits() {
  return (
    <section className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Benefícios"
          title="Por que regularizar e reduzir o INSS da sua obra"
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.id} className="card">
              <h3 className="text-base font-bold uppercase tracking-wide text-accent-600">{benefit.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">{benefit.descricao}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
