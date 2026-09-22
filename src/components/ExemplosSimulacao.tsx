import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { EXEMPLOS_SIMULACAO } from '@/data/exemplosSimulacao';
import { trackEvent } from '@/services/analytics';

/**
 * Exemplos ilustrativos de simulação (faixa de redução por perfil de obra).
 * IMPORTANTE: não são depoimentos nem casos reais de clientes — só mostram a
 * faixa de redução que a metodologia costuma alcançar, com o disclaimer visível.
 */
export function ExemplosSimulacao() {
  return (
    <section className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Exemplos de simulação"
          title="Faixas de redução por perfil de obra"
          description="Exemplos ilustrativos, calculados pela mesma metodologia usada na sua simulação — não são depoimentos nem casos de clientes reais."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EXEMPLOS_SIMULACAO.map((exemplo) => (
            <div key={exemplo.id} className="card text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">{exemplo.situacao}</p>
              <p className="mt-1 text-sm font-semibold text-navy-800">{exemplo.perfilObra}</p>
              <p className="mt-1 text-xs text-navy-400">{exemplo.area}</p>
              <p className="mt-4 text-3xl font-extrabold text-accent-600">{exemplo.reducaoPercentual}%</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">de redução estimada</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-navy-400">
          * Exemplos ilustrativos de simulação, não representam clientes reais. A redução aplicável à sua obra
          depende das características e da documentação específicas dela — faça a simulação abaixo para ter uma
          estimativa do seu caso.
        </p>

        <div className="mt-8 text-center">
          <a
            href="#calculadora"
            className="btn-primary"
            onClick={() => trackEvent('click_simular', { origem: 'exemplos_simulacao' })}
          >
            Simular a minha obra
          </a>
        </div>
      </Container>
    </section>
  );
}
