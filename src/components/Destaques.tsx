import { Container } from '@/components/ui/Container';

interface Destaque {
  id: string;
  titulo: string;
  texto: string;
  icone: 'casa' | 'check' | 'dinheiro';
}

const DESTAQUES: Destaque[] = [
  {
    id: 'regularizacao',
    titulo: 'Regularização de Obra',
    texto: 'Regularize sua obra na Receita Federal de forma organizada: CNO, SERO e a certidão (CND) em ordem.',
    icone: 'casa',
  },
  {
    id: 'reducao',
    titulo: 'Redução do INSS',
    texto: 'Aplicamos as reduções previstas na IN RFB 2.021/2021 para você pagar o valor correto da sua obra.',
    icone: 'check',
  },
  {
    id: 'parcelamento',
    titulo: 'Parcelamento do INSS de obra',
    texto: 'O saldo do INSS da obra pode ser parcelado em até 60 vezes, e eu cuido do parcelamento para você.',
    icone: 'dinheiro',
  },
];

function Icone({ tipo }: { tipo: Destaque['icone'] }) {
  const comum = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'h-6 w-6', 'aria-hidden': true };
  if (tipo === 'casa')
    return (
      <svg {...comum}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </svg>
    );
  if (tipo === 'check')
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.8 2.8L16.5 9.5" />
      </svg>
    );
  return (
    <svg {...comum}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </svg>
  );
}

/** Três destaques logo abaixo do topo do site, sobrepostos à borda inferior do Hero. */
export function Destaques() {
  return (
    <section aria-label="Destaques" className="relative z-10 -mt-14 pb-4 sm:-mt-16">
      <Container>
        <ul className="grid gap-4 md:grid-cols-3">
          {DESTAQUES.map((d) => (
            <li
              key={d.id}
              className="flex items-start gap-4 rounded-xl border border-navy-100 bg-white/95 p-5 shadow-card backdrop-blur"
            >
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
                <Icone tipo={d.icone} />
              </span>
              <div>
                <h3 className="text-base font-bold text-navy-900">{d.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-navy-600">{d.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
