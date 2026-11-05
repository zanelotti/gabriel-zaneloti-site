import { Container } from '@/components/ui/Container';
import { BotaoWhatsApp } from '@/components/ui/BotaoWhatsApp';
import { trackEvent } from '@/services/analytics';

const ITENS = [
  'A certidão da obra (CND ou CPEND) em mãos, sem correria de última hora.',
  'A tranquilidade de saber que a Receita não tem pendência da sua obra.',
  'Liberdade para vender, financiar, doar ou averbar o imóvel quando quiser.',
  'A certeza de ter pago o valor correto — e não mais do que o necessário.',
];

/** "Imagine como seria": mostra o resultado que a pessoa quer, antes do agendamento. */
export function Tranquilidade() {
  return (
    <section className="scroll-mt-20 py-16 sm:py-24">
      <Container>
        <div className="mx-auto max-w-3xl rounded-xl2 bg-navy-950 p-7 text-center shadow-card sm:p-12">
          <span className="section-eyebrow text-accent-400">Imagine só</span>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Sua obra em dia, sem dor de cabeça com a Receita
          </h2>

          <ul className="mx-auto mt-7 grid max-w-xl gap-3 text-left">
            {ITENS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-navy-100 sm:text-base">
                <svg viewBox="0 0 16 16" fill="none" className="mt-1 h-4 w-4 shrink-0 text-accent-400" aria-hidden="true">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <BotaoWhatsApp origem="tranquilidade" texto="Falar com o Gabriel agora" className="w-full sm:w-auto" />
            <a
              href="#agendar"
              className="btn w-full border-2 border-white/30 text-white hover:bg-white/10 sm:w-auto"
              onClick={() => trackEvent('click_agendar', { origem: 'tranquilidade' })}
            >
              Agendar consultoria gratuita
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
