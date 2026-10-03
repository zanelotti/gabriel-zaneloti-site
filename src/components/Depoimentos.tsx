import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Depoimento {
  texto: string;
  /** Classes de largura da grade — as três primeiras ocupam 1/3, as duas últimas 1/2 (em telas grandes). */
  span: string;
}

/**
 * Feedbacks reais recebidos por WhatsApp. Por privacidade, nenhum nome,
 * telefone ou dado da obra é exibido — só o que o cliente disse.
 */
const DEPOIMENTOS: Depoimento[] = [
  {
    texto:
      'Gostei do seu serviço, foi bastante objetivo e prático e com preço justo. Resolvendo de forma rápida a regularização do INSS da minha obra.',
    span: 'lg:col-span-2',
  },
  {
    texto:
      'Para mim foi um trabalho excelente, foi rápido e ajudou muito a gente. Porque o valor que a gente teria que pagar sem o seu trabalho seria muito alto, e com o seu trabalho reduziu muito o valor e ainda teve como parcelar.',
    span: 'lg:col-span-2',
  },
  {
    texto:
      'O valor veio até mais baixo do que você tinha simulado, poxa muito obrigado, salvou minha pele, eu tava ficando nervoso com o valor. Vou recomendar aos meus amigos.',
    span: 'lg:col-span-2',
  },
  {
    texto: 'Foi rápido até, muito bom, vou pagar agora mesmo, muito obrigado pela agilidade no atendimento.',
    span: 'lg:col-span-3',
  },
  {
    texto:
      'Com certeza foi top, já passei seu contato pro pessoal do condomínio aqui e alguns já disseram que entraram em contato. Nota mil!',
    span: 'sm:col-span-2 lg:col-span-3',
  },
];

function DepoimentoCard({ texto, span }: Depoimento) {
  return (
    <figure className={`flex flex-col rounded-xl2 border border-navy-100 bg-white p-6 shadow-soft ${span}`}>
      <span aria-hidden="true" className="text-4xl font-extrabold leading-none text-accent-500">
        “
      </span>
      <blockquote className="mt-2 flex-1 text-base leading-relaxed text-navy-700">{texto}</blockquote>
      <figcaption className="mt-5 text-sm font-semibold text-navy-500">
        Cliente · regularização de INSS de obra
      </figcaption>
    </figure>
  );
}

/** Seção de prova social: depoimentos reais de clientes, de forma compacta e anônima. */
export function Depoimentos() {
  return (
    <section id="depoimentos" className="scroll-mt-20 bg-navy-50 py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow="Depoimentos" title="O que dizem os clientes que já regularizaram" />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {DEPOIMENTOS.map((depoimento) => (
            <DepoimentoCard key={depoimento.texto} {...depoimento} />
          ))}
        </div>
      </Container>
    </section>
  );
}
