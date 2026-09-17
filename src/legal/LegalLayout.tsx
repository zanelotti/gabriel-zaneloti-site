import type { ReactNode } from 'react';

interface LegalLayoutProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

/** Layout simples e compartilhado para as páginas institucionais (Política de Privacidade, Termos de Uso). */
export function LegalLayout({ title, updatedAt, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-navy-50">
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

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold text-navy-900">{title}</h1>
        <p className="mt-2 text-sm text-navy-400">Última atualização: {updatedAt}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-navy-600">{children}</div>

        <a
          href="/"
          className="mt-12 inline-block text-sm font-semibold text-navy-700 underline hover:text-accent-600"
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
