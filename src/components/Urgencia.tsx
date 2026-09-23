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
 * cálculo e das obrigações acessórias da obra (correção pela Selic, multa por
 * falta de entrega da DCTFWeb, tratamento mais brando para quem regulariza
 * por conta própria), sem apelar para medo forçado. Objetivo: mostrar que
 * esperar tem um custo real e mensurável, não criar pressão artificial.
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
            titulo="A dívida é corrigida por juros e correção mês a mês"
            descricao="Enquanto a obra não é regularizada, o valor presumido pela Receita Federal é atualizado pela taxa Selic todo mês — quanto mais tempo passa, maior fica o débito a ser negociado."
          />
          <UrgencyPoint
            titulo="A falta de entrega da DCTFWeb gera multa"
            descricao="A DCTFWeb Aferição de Obras deve ser entregue enquanto a obra está em andamento. Deixar de entregá-la gera multa por atraso ou omissão — além de comprometer benefícios que dependem da entrega contínua, como o Fator de Ajuste."
          />
          <UrgencyPoint
            titulo="Regularizar antes de ser fiscalizado evita multas maiores"
            descricao="A legislação trata melhor quem regulariza por conta própria do que quem é autuado depois de uma fiscalização. Esperar aumenta o risco de a pendência virar um Auto de Infração, com cobrança mais pesada do que a regularização voluntária."
          />
        </div>
      </Container>
    </section>
  );
}
