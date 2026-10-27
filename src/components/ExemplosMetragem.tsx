import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Exemplo {
  area: string;
  sem: string;
  com: string;
  economia: string;
}

/**
 * Potencial MÁXIMO de redução (até 70%) aplicado sobre o INSS estimado pela calculadora do site
 * (casa residencial de alvenaria, obra nova, SP, pessoa física, obra de 03/2023 a 03/2024, out/2026).
 * Não é resultado típico: o aviso abaixo da tabela deixa isso claro.
 */
const EXEMPLOS: Exemplo[] = [
  { area: '100 m²', sem: 'R$ 3.544', com: 'R$ 1.063', economia: 'R$ 2.481' },
  { area: '150 m²', sem: 'R$ 10.632', com: 'R$ 3.190', economia: 'R$ 7.442' },
  { area: '200 m²', sem: 'R$ 14.176', com: 'R$ 4.253', economia: 'R$ 9.923' },
  { area: '300 m²', sem: 'R$ 29.239', com: 'R$ 8.772', economia: 'R$ 20.467' },
  { area: '400 m²', sem: 'R$ 49.618', com: 'R$ 14.885', economia: 'R$ 34.733' },
  { area: '500 m²', sem: 'R$ 79.743', com: 'R$ 23.923', economia: 'R$ 55.820' },
];

/** Tabela de exemplos por metragem: mostra o potencial máximo de redução para quem ainda não quer preencher a simulação. */
export function ExemplosMetragem() {
  return (
    <section id="exemplos" className="scroll-mt-20 bg-navy-50 py-16 sm:py-20">
      <Container>
        <SectionHeading
          eyebrow="Exemplos"
          title="Quanto sua obra pode economizar de INSS"
          description="Veja o potencial máximo de redução (até 70%*) para casas de diferentes tamanhos. Simule para ver o que a sua obra pode alcançar."
        />

        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl border border-navy-100 bg-white shadow-soft">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-navy-900 text-[10px] uppercase tracking-wide text-white sm:text-xs">
              <tr>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Área</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Sem estratégia</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Redução máxima*</th>
                <th scope="col" className="px-2 py-3 font-semibold sm:px-4">Economia potencial</th>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-4 max-w-3xl text-center text-xs leading-relaxed text-navy-500">
          *Potencial máximo de redução (até 70%) aplicado sobre o INSS estimado pela nossa calculadora para casa residencial de alvenaria, obra nova em São Paulo, pessoa física, com obra de 03/2023 a 03/2024. Nem toda obra alcança esse percentual: o resultado real depende das características, da documentação e da situação de cada obra e se confirma na análise.
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
