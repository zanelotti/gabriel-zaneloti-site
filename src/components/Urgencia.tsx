import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface UrgencyPointProps {
  titulo: string;
  descricao: string;
}

function UrgencyPoint({ titulo, descricao }: UrgencyPointProps) {
  return (
    <div className="rounded-xl2 border border-navy-100 bg-white p-6">
      <h3 className="text-base font-bold text-navy-900">{titulo}</h3>
      <p className="mt-2 text-sm leading-relaxed text-navy-500">{descricao}</p>
    </div>
  );
}

/**
 * Seção de urgência legítima — baseada em fatos reais do próprio mecanismo de
 * cálculo (correção pela Selic, decadência de 5 anos, validade da CND), sem
 * apelar para medo forçado. Objetivo: mostrar que esperar tem um custo real e
 * mensurável, não criar pressão artificial.
 */
export function Urgencia() {
  return (
    <section className="scroll-mt-20 py-20 sm:py-28">
      <Container>
        <SectionHeading
          eyebrow="Por que não vale a pena esperar"
          title="O tempo joga contra quem deixa a obra pendente"
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          <UrgencyPoint
            titulo="A dívida é corrigida mês a mês"
            descricao="Enquanto a obra não é regularizada, o valor presumido pela Receita Federal é atualizado pela taxa Selic todo mês — quanto mais tempo passa, maior fica o débito a ser negociado."
          />
          <UrgencyPoint
            titulo="A decadência de 5 anos continua contando"
            descricao="A Receita Federal perde o direito de cobrar valores após 5 anos do fato gerador. Esse prazo não para — quanto antes analisamos sua obra, maiores as chances de aproveitar competências que ainda estão dentro dessa janela."
          />
          <UrgencyPoint
            titulo="A CND vale só 180 dias"
            descricao="Depois de obtida, a Certidão Negativa de Débitos da obra tem validade de 180 dias. Se você está planejando vender, financiar ou averbar o imóvel, o momento de regularizar é antes de precisar dela com urgência."
          />
        </div>
      </Container>
    </section>
  );
}
