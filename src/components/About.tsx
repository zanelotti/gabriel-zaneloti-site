import { Container } from '@/components/ui/Container';

export function About() {
  return (
    <section id="sobre" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="animate-fade-in-up">
          <span className="section-eyebrow">Sobre mim</span>
          <h2 className="section-title">Quem é Gabriel Zaneloti?</h2>

          <p className="mt-5 text-base leading-relaxed text-navy-600 sm:text-lg">
            Especialista em consultoria tributária, com foco em redução de INSS para obras. Com vasta experiência
            no setor de construção, ele ajuda proprietários, empresas e construtores a economizarem de maneira
            eficaz, utilizando o Fator de Ajuste e garantindo conformidade com o Cadastro Nacional de Obras (CNO),
            o SERO e a emissão de DARF.
          </p>

          <p className="mt-4 text-base leading-relaxed text-navy-600 sm:text-lg">
            Seu compromisso é otimizar os custos de cada cliente, com soluções personalizadas para cada projeto de
            construção.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="text-3xl font-extrabold text-navy-900">+R$ 1 milhão</p>
              <p className="text-sm font-semibold text-accent-600">já economizados por clientes</p>
            </div>
            <a href="/sobre.html" className="text-sm font-semibold text-navy-600 underline hover:text-accent-600">
              Conheça mais sobre mim →
            </a>
          </div>
        </div>

        <div className="rounded-xl2 bg-navy-900 p-8 text-center shadow-card animate-fade-in">
          <div className="mx-auto h-40 w-40 overflow-hidden rounded-full border-4 border-accent-400/40 bg-navy-800">
            <img
              src="/gabriel-zaneloti.jpg"
              alt="Gabriel Zaneloti, planejador tributário"
              width={160}
              height={160}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>

          <h3 className="mt-5 text-xl font-bold text-white">Gabriel Zaneloti</h3>
          <p className="text-sm font-semibold text-accent-400">Planejador tributário</p>

          <p className="mt-5 text-sm leading-relaxed text-navy-200">
            "Meu objetivo principal é garantir que cada cliente consiga uma redução significativa nos custos de
            INSS da sua obra, maximizando os resultados e mantendo a conformidade fiscal."
          </p>
        </div>
      </Container>
    </section>
  );
}
