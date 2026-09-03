import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { HOW_IT_WORKS_STEPS } from '@/data/howItWorks';

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-20 bg-navy-900 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Saiba"
          title="Como vou te auxiliar"
          description="Um processo claro, do primeiro contato até a regularização da sua obra."
        />

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <div key={item.numero} className="relative">
              <span className="text-4xl font-extrabold text-white/10">{item.numero}</span>
              <h3 className="mt-2 text-lg font-bold text-white">{item.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-200">{item.descricao}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
