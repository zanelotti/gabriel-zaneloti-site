import { generateGenericWhatsAppLink } from '@/services/whatsapp';

function H2({ children }: { children: string }) {
  return <h2 className="text-xl font-bold text-navy-900 sm:text-2xl">{children}</h2>;
}

/** Página institucional "Sobre o Gabriel" — usa apenas conteúdo já estabelecido no site (About/Authority). */
export default function Sobre() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-navy-950 py-8">
        <div className="mx-auto max-w-3xl px-6">
          <a href="/" className="text-lg font-extrabold text-white">
            GABRIEL ZANELOTI
          </a>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-accent-400">
            Planejamento Tributário | INSS de Obras
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <div className="text-center">
          <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-accent-400/40 bg-navy-800">
            <img
              src="/gabriel-zaneloti.jpg"
              alt="Gabriel Zaneloti, planejador tributário"
              width={128}
              height={128}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold text-navy-900 sm:text-4xl">Gabriel Zaneloti</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-accent-600">
            Planejador tributário · Especialista em INSS de Obras
          </p>
        </div>

        <blockquote className="mx-auto mt-8 max-w-xl rounded-xl2 border border-navy-100 bg-navy-50/60 p-6 text-center text-base italic leading-relaxed text-navy-700">
          "Meu objetivo principal é garantir que cada cliente consiga uma redução significativa nos custos de INSS
          da sua obra, maximizando os resultados e mantendo a conformidade fiscal."
        </blockquote>

        <div className="mt-12 space-y-4">
          <H2>Quem é Gabriel Zaneloti</H2>
          <p className="text-base leading-relaxed text-navy-600">
            Especialista em consultoria tributária, com foco em redução de INSS para obras. Com vasta experiência no
            setor de construção, ele ajuda proprietários, empresas e construtores a economizarem de maneira eficaz,
            utilizando o Fator de Ajuste e garantindo conformidade com o Cadastro Nacional de Obras (CNO), o SERO e
            a emissão de DARF.
          </p>
          <p className="text-base leading-relaxed text-navy-600">
            Seu compromisso é otimizar os custos de cada cliente, com soluções personalizadas para cada projeto de
            construção — atendendo obras residenciais, comerciais e industriais em qualquer estado do Brasil, de
            forma remota.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          <H2>Como funciona o meu trabalho</H2>
          <p className="text-base leading-relaxed text-navy-600">
            Analiso as características e a documentação da sua obra à luz da Instrução Normativa RFB nº 2021/2021,
            identificando as possibilidades legais de redução aplicáveis ao seu caso, e conduzo todo o processo de
            regularização junto ao CNO e ao SERO até a emissão da certidão.
          </p>
          <div className="rounded-xl2 border border-accent-200 bg-accent-50 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-accent-700">Modelo de 100% êxito</p>
            <p className="mt-2 text-sm leading-relaxed text-navy-700">
              O diagnóstico inicial é sempre gratuito e sem compromisso. Quando há redução aplicável, o honorário é
              uma porcentagem sobre a economia efetivamente comprovada; quando não há redução a aplicar, mas a obra
              ainda precisa ser regularizada, cobro um valor mínimo, calculado conforme a complexidade do processo.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl2 bg-navy-950 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-400">Resultados</p>
          <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">+R$ 1 milhão</p>
          <p className="mt-1 text-sm text-navy-300">já economizados por clientes em INSS de obras</p>
        </div>

        <div className="mt-12 text-center">
          <a
            href={generateGenericWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full sm:w-auto"
          >
            Falar com Gabriel no WhatsApp
          </a>
          <p className="mt-4">
            <a href="/#calculadora" className="text-sm font-semibold text-navy-600 underline hover:text-accent-600">
              Ou faça uma simulação gratuita
            </a>
          </p>
        </div>

        <a
          href="/"
          className="mt-14 inline-block text-sm font-semibold text-navy-700 underline hover:text-accent-600"
        >
          ← Voltar para o site
        </a>
      </main>

      <footer className="border-t border-navy-100 py-8 text-center text-xs text-navy-400">
        © {new Date().getFullYear()} Gabriel Zaneloti. Todos os direitos reservados.
      </footer>
    </div>
  );
}
