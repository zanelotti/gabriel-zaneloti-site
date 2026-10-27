import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Exemplo {
  area: string;
  sem: string;
  com: string;
  economia: string;
  pct: string;
}

/**
 * Exemplos gerados pelo motor da própria calculadora do site (calculateINSS):
 * casa residencial de alvenaria, obra nova, SP, pessoa física, obra de 03/2023 a 03/2024 (out/2026).
 */
const EXEMPLOS: Exemplo[] = [
  { area: '100 m²', sem: 'R$ 3.544', com: 'R$ 2.404', economia: 'R$ 1.140', pct: '32%' },
  { area: '150 m²', sem: 'R$ 10.632', com: 'R$ 4.611', economia: 'R$ 6.021', pct: '57%' },
  { area: '200 m²', sem: 'R$ 14.176', com: 'R$ 5.715', economia: 'R$ 8.461', pct: '60%' },
  { area: '300 m²', sem: 'R$ 29.239', com: 'R$ 10.407', economia: 'R$ 18.832', pct: '64%' },
  { area: '400 m²', sem: 'R$ 49.618', com: 'R$ 22.935', economia: 'R$ 26.683', pct: '54%' },
  { area: '500 m²', sem: 'R$ 79.743', com: 'R$ 36.071', economia: 'R$ 43.672', pct: '55%' },
];

/** Tabela de exemplos por metragem: resposta imediata para quem ainda não quer preencher a simulação. */
export function ExemplosMetragem() {
  return (
    <section id="exemplos" className="scroll-mt-20 bg-navy-50 py-16 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow="Exemplos"
          title="Quanto uma obra pode reduzir de INSS"
          description="Veja estimativas para casas de diferentes tamanhos. A sua obra pode ter outro resultado: simule para ver o seu caso."
        />

        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-navy-100 bg-white shadow-soft">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-navy-900 text-[10px] uppercase tracking-wide text-white sm:text-xs">
              <tr>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Área</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Sem estratégia</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Com estratégia</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Economia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100 text-navy-800">
              {EXEMPLOS.map((e) => (
                <tr key={e.area}>
                  <th scope="row" className="whitespace-nowrap px-2 py-3 font-bold text-navy-900 sm:px-4">{e.area}</th>
                  <td className="px-2 py-3 text-navy-500 line-through decoration-navy-300 sm:px-4">{e.sem}</td>
                  <td className="px-2 py-3 font-semibold sm:px-4">{e.com}</td>
                  <td className="px-2 py-3 font-bold text-accent-700 sm:px-4">
                    <span className="whitespace-nowrap">{e.economia}</span>
                    <span className="block font-semibold text-accent-600">{e.pct}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-navy-500">
          Estimativas da nossa calculadora para casa residencial de alvenaria, obra nova em São Paulo, pessoa física, com obra de 03/2023 a 03/2024. O valor real depende das características, da documentação e da situação de cada obra e se confirma na análise.
        </p>

        <div className="mt-8 text-center">
          <a href="#calculadora" className="btn-primary">
            Simular a minha obra
          </a>
        </div>
      </Container>
    </section>
  );
}
