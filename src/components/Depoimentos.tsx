import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Print {
  arquivo: string;
  largura: number;
  altura: number;
  alt: string;
}

/**
 * Prints reais de conversas de WhatsApp com clientes. Por privacidade, nome,
 * foto, telefone e número da obra foram removidos ou cobertos em cada imagem
 * (arquivos em /public/depoimentos).
 */
const PRINTS: Print[] = [
  {
    arquivo: 'depoimento-1.jpg',
    largura: 571,
    altura: 757,
    alt: 'Conversa de WhatsApp: cliente diz que gostou do serviço, objetivo, prático, com preço justo, resolvendo de forma rápida a regularização do INSS da obra.',
  },
  {
    arquivo: 'depoimento-2.jpg',
    largura: 571,
    altura: 780,
    alt: 'Conversa de WhatsApp: cliente diz que foi um trabalho excelente e rápido, que o valor sem o serviço seria muito alto e que, com o serviço, o valor reduziu muito e ainda teve como parcelar.',
  },
  {
    arquivo: 'depoimento-3.jpg',
    largura: 512,
    altura: 275,
    alt: 'Conversa de WhatsApp: cliente diz que o valor veio mais baixo do que o simulado, agradece e diz que vai recomendar aos amigos.',
  },
  {
    arquivo: 'depoimento-4.jpg',
    largura: 720,
    altura: 625,
    alt: 'Conversa de WhatsApp: após receber a certidão, cliente diz que foi rápido, muito bom, e agradece pela agilidade no atendimento.',
  },
  {
    arquivo: 'depoimento-5.jpg',
    largura: 719,
    altura: 850,
    alt: 'Conversa de WhatsApp: após receber a certidão, cliente diz que foi top e que já passou o contato para o pessoal do condomínio, e alguns já entraram em contato.',
  },
];

/** Seção de prova social: prints reais de feedbacks de clientes (com dados pessoais ocultados). */
export function Depoimentos() {
  return (
    <section id="depoimentos" className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Depoimentos"
          title="O que dizem os clientes que já regularizaram"
          description="Mensagens reais recebidas por WhatsApp, com os dados dos clientes ocultados."
        />

        <div className="mt-12 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {PRINTS.map((print) => (
            <a
              key={print.arquivo}
              href={`/depoimentos/${print.arquivo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-5 block break-inside-avoid overflow-hidden rounded-xl2 border border-navy-100 bg-white shadow-soft transition-shadow duration-200 hover:shadow-card"
            >
              <img
                src={`/depoimentos/${print.arquivo}`}
                alt={print.alt}
                width={print.largura}
                height={print.altura}
                loading="lazy"
                className="block h-auto w-full"
              />
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
