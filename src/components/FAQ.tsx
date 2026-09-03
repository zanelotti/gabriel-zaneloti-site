import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FAQ_ITEMS } from '@/data/faq';
import { trackEvent } from '@/services/analytics';

function FAQAccordionItem({ pergunta, resposta, index }: { pergunta: string; resposta: string; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) trackEvent('faq_opened', { pergunta });
  };

  return (
    <div className="border-b border-navy-100">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={toggle}
          className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-navy-900 sm:text-lg"
        >
          <span>{pergunta}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`h-5 w-5 flex-shrink-0 text-accent-600 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid overflow-hidden transition-all duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="text-sm leading-relaxed text-navy-500 sm:text-base">{resposta}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="Dúvidas frequentes" title="Perguntas sobre INSS de obras" />

        <div className="mt-10">
          {FAQ_ITEMS.map((item, index) => (
            <FAQAccordionItem key={item.pergunta} pergunta={item.pergunta} resposta={item.resposta} index={index} />
          ))}
        </div>

        <div className="mt-12 text-center">
          <a
            href="#calculadora"
            className="btn-primary"
            onClick={() => trackEvent('click_simular', { origem: 'faq' })}
          >
            Quero saber quanto posso economizar
          </a>
        </div>
      </Container>
    </section>
  );
}
