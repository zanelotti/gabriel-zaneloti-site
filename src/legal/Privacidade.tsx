import type { ReactNode } from 'react';
import { LegalLayout } from './LegalLayout';

function H2({ children }: { children: string }) {
  return <h2 className="pt-2 text-lg font-bold text-navy-900">{children}</h2>;
}

function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

export default function Privacidade() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="17 de setembro de 2026">
      <p>
        Esta Política de Privacidade explica quais dados este site coleta, para que servem e quais direitos
        você tem sobre eles, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
        LGPD). Ao preencher o formulário de simulação ou entrar em contato pelos canais deste site, você
        declara estar ciente desta política.
      </p>

      <H2>1. Quem trata os seus dados</H2>
      <p>
        O tratamento dos dados coletados neste site é feito por Gabriel Zaneloti, profissional autônomo
        especializado em planejamento tributário de INSS de obras. Dúvidas ou solicitações sobre seus dados
        podem ser enviadas para{' '}
        <a href="mailto:comercial.mfzeng@gmail.com" className="font-semibold underline">
          comercial.mfzeng@gmail.com
        </a>
        .
      </p>

      <H2>2. Quais dados são coletados</H2>
      <p>Ao usar a calculadora de simulação, coletamos:</p>
      <Ul>
        <li>Nome e número de WhatsApp;</li>
        <li>
          Dados da obra informados por você (datas de início/fim, responsável, tipo, situação, categoria,
          estado, destinação, áreas e observações);
        </li>
        <li>O resultado estimado da simulação, calculado a partir desses dados.</li>
      </Ul>
      <p>
        Também podemos coletar automaticamente dados de navegação (como páginas visitadas e origem do
        acesso) por meio de ferramentas de analytics e publicidade, descritas na seção 5.
      </p>

      <H2>3. Para que usamos os seus dados</H2>
      <Ul>
        <li>Calcular e enviar a estimativa de simulação solicitada;</li>
        <li>Entrar em contato para dar continuidade ao atendimento sobre a sua obra;</li>
        <li>Manter um registro interno de simulações e leads recebidos;</li>
        <li>Medir a performance do site e das campanhas de divulgação (de forma agregada/estatística).</li>
      </Ul>
      <p>Não vendemos nem compartilhamos seus dados com terceiros para fins de marketing de terceiros.</p>

      <H2>4. Com quem os dados são compartilhados</H2>
      <p>Seus dados podem ser processados pelos seguintes prestadores de serviço, estritamente como parte do funcionamento do site:</p>
      <Ul>
        <li>
          <strong>Resend</strong> — envio do e-mail de notificação de nova simulação;
        </li>
        <li>
          <strong>Supabase</strong> — armazenamento do histórico de simulações;
        </li>
        <li>
          <strong>Vercel</strong> — hospedagem do site.
        </li>
      </Ul>

      <H2>5. Cookies, analytics e publicidade</H2>
      <p>
        Este site pode utilizar ferramentas como Google Analytics, Google Ads e/ou Meta Ads para entender
        como os visitantes usam o site e para medir o resultado de campanhas de anúncios. Essas ferramentas
        podem usar cookies e identificadores do navegador para fins estatísticos e de mensuração de
        conversão. Você pode gerenciar ou bloquear cookies diretamente nas configurações do seu navegador.
      </p>

      <H2>6. Por quanto tempo os dados são guardados</H2>
      <p>
        Os dados são mantidos pelo tempo necessário para o atendimento e para fins de histórico comercial,
        podendo ser excluídos a qualquer momento mediante solicitação (ver seção 7).
      </p>

      <H2>7. Seus direitos como titular dos dados</H2>
      <p>Nos termos da LGPD, você pode, a qualquer momento, solicitar:</p>
      <Ul>
        <li>Confirmação de que seus dados são tratados;</li>
        <li>Acesso, correção ou atualização dos seus dados;</li>
        <li>Exclusão dos seus dados (exceto quando houver obrigação legal de retenção);</li>
        <li>Revogação do consentimento dado anteriormente.</li>
      </Ul>
      <p>
        Para exercer qualquer um desses direitos, entre em contato pelo e-mail{' '}
        <a href="mailto:comercial.mfzeng@gmail.com" className="font-semibold underline">
          comercial.mfzeng@gmail.com
        </a>
        .
      </p>

      <H2>8. Alterações desta política</H2>
      <p>
        Esta política pode ser atualizada periodicamente. A data da última atualização está sempre indicada
        no topo desta página.
      </p>

      <p className="pt-4 text-xs text-navy-400">
        Este texto tem caráter informativo geral e não substitui uma análise jurídica específica do seu
        caso.
      </p>
    </LegalLayout>
  );
}
