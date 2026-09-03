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

          <div className="mt-8">
            <p className="text-3xl font-extrabold text-navy-900">+R$ 1 milhão</p>
            <p className="text-sm font-semibold text-accent-600">já economizados por clientes</p>
          </div>
        </div>

        <div className="rounded-xl2 bg-navy-900 p-8 text-center shadow-card animate-fade-in">
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border-4 border-accent-400/40 bg-navy-800">
            {/* Espaço reservado para a fotografia profissional de Gabriel Zaneloti */}
            <svg viewBox="0 0 24 24" fill="none" className="h-16 w-16 text-navy-500" aria-hidden="true">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
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
