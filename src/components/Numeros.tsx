import { Container } from '@/components/ui/Container';

interface Numero {
  valor: string;
  rotulo: string;
}

/** Números reais dos contratos do Gabriel (set/2024 a set/2026), do painel de controle dele. */
const NUMEROS: Numero[] = [
  { valor: 'R$ 1,09 mi', rotulo: 'de INSS economizados para os clientes' },
  { valor: '58%', rotulo: 'de redução média sobre o INSS da obra' },
];

/** Faixa de prova social com os resultados reais, logo abaixo dos três destaques. */
export function Numeros() {
  return (
    <section aria-label="Resultados" className="bg-white pb-6 pt-12 sm:pt-16">
      <Container>
        <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-x-4 gap-y-8 text-center">
          {NUMEROS.map((n) => (
            <li key={n.rotulo}>
              <p className="text-3xl font-extrabold tracking-tight text-navy-900 sm:text-4xl">{n.valor}</p>
              <p className="mx-auto mt-1 max-w-[16rem] text-sm leading-snug text-navy-600">{n.rotulo}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-navy-400">
          Dados dos contratos do Gabriel Zaneloti entre set/2024 e set/2026. A redução média é calculada sobre o INSS sem ajuste de cada obra; o resultado varia em cada caso.
        </p>
      </Container>
    </section>
  );
}
