import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { BRASIL_VIEWBOX, ESTADOS_MAPA } from '@/data/brasilMapa';

/** Mapa do Brasil mostrando que o atendimento (regularização e redução do INSS de obra) é feito em todos os estados. */
export function BrasilMapa() {
  const [ativo, setAtivo] = useState<string | null>(null);
  const estadoAtivo = ESTADOS_MAPA.find((e) => e.id === ativo);

  return (
    <section id="todo-brasil" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Atendimento nacional"
            title="Regularização de obra em todo o Brasil"
            description="Não importa onde sua obra esteja: o processo é todo feito à distância, por WhatsApp, ligação ou videochamada, e vale para os 26 estados e o Distrito Federal."
          />
          <ul className="mt-8 grid gap-3 text-sm font-semibold text-navy-800 sm:grid-cols-2">
            {['Atendimento 100% online', 'Todos os 26 estados e o DF', 'Acompanhamento por 5 anos', 'Fale direto com o Gabriel'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 flex-shrink-0 text-accent-600" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
                    clipRule="evenodd"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <a href="#calculadora" className="btn-primary mt-8">
            Simular minha obra
          </a>
        </div>

        <figure className="mx-auto w-full max-w-md lg:max-w-lg">
          <svg
            viewBox={BRASIL_VIEWBOX}
            role="img"
            aria-label="Mapa do Brasil com todos os estados atendidos"
            className="h-auto w-full drop-shadow-[0_18px_24px_rgba(15,22,56,0.25)]"
          >
            {ESTADOS_MAPA.map((e) => (
              <path
                key={e.id}
                d={e.path}
                onMouseEnter={() => setAtivo(e.id)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(e.id)}
                onBlur={() => setAtivo(null)}
                tabIndex={0}
                aria-label={e.nome}
                className={`cursor-pointer stroke-white outline-none transition-colors duration-150 ${
                  ativo === e.id ? 'fill-accent-500' : 'fill-navy-500 hover:fill-accent-500'
                }`}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            ))}
            {ESTADOS_MAPA.map((e) => (
              <circle key={`pin-${e.id}`} cx={e.cx} cy={e.cy} r={4.5} className="pointer-events-none fill-amber-500 stroke-white" strokeWidth={1.5} />
            ))}
          </svg>
          <figcaption className="mt-3 min-h-[1.5rem] text-center text-sm font-semibold text-navy-700">
            {estadoAtivo ? `${estadoAtivo.nome}: atendemos aqui` : 'Passe o mouse ou toque em um estado'}
          </figcaption>
          <p className="mt-1 text-center text-[11px] text-navy-300">Mapa: @svg-maps/brazil (CC BY 4.0)</p>
        </figure>
      </Container>
    </section>
  );
}
