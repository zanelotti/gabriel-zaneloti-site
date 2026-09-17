import type { ReactNode } from 'react';
import { LegalLayout } from './LegalLayout';

function H2({ children }: { children: string }) {
  return <h2 className="pt-2 text-lg font-bold text-navy-900">{children}</h2>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

export default function Termos() {
  return (
    <LegalLayout title="Termos de Uso" updatedAt="17 de setembro de 2026">
      <p>
        Estes Termos de Uso regulam o acesso e a utilização deste site, mantido por Gabriel Zaneloti,
        profissional autônomo especializado em planejamento tributário de INSS de obras. Ao usar este site,
        você concorda com os termos abaixo.
      </p>

      <H2>1. Sobre a simulação de INSS de obra</H2>
      <p>
        A calculadora deste site gera uma <strong>estimativa inicial</strong>, calculada a partir das
        informações fornecidas por você (área, destinação, tipo, categoria e datas da obra) e das mecânicas
        oficiais previstas na IN RFB nº 2021/2021 (Fator de Ajuste, Selic, CPP, multa, MAED). Essa estimativa:
      </p>
      <Ul>
        <li>Não substitui uma análise técnica e tributária da documentação real da obra;</li>
        <li>Pode divergir do valor final apurado oficialmente, que depende da RMT real da obra;</li>
        <li>Não constitui garantia de resultado, economia ou percentual de redução específico.</li>
      </Ul>

      <H2>2. Uso do site</H2>
      <p>
        Você concorda em fornecer informações verdadeiras ao preencher o formulário de simulação e em não
        utilizar o site para finalidades ilícitas ou que possam prejudicar seu funcionamento.
      </p>

      <H2>3. Propriedade intelectual</H2>
      <p>
        Todo o conteúdo deste site (textos, layout, marca e metodologia de cálculo) pertence a Gabriel
        Zaneloti, sendo vedada a reprodução total ou parcial sem autorização prévia.
      </p>

      <H2>4. Limitação de responsabilidade</H2>
      <p>
        As informações apresentadas neste site têm caráter informativo. A contratação de serviços de
        planejamento tributário, regularização e aferição de obra é formalizada separadamente, com escopo e
        condições próprias, definidos em contrato específico entre as partes.
      </p>

      <H2>5. Privacidade</H2>
      <p>
        O tratamento de dados pessoais coletados neste site segue o disposto na nossa{' '}
        <a href="/privacidade.html" className="font-semibold underline">
          Política de Privacidade
        </a>
        .
      </p>

      <H2>6. Alterações destes termos</H2>
      <p>
        Estes termos podem ser atualizados periodicamente. A data da última atualização está sempre indicada
        no topo desta página.
      </p>

      <H2>7. Legislação aplicável</H2>
      <p>Estes termos são regidos pela legislação brasileira.</p>

      <p className="pt-4 text-xs text-navy-400">
        Este texto tem caráter informativo geral e não substitui uma análise jurídica específica do seu
        caso.
      </p>
    </LegalLayout>
  );
}
