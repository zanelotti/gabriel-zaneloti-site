import { useEffect, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { trackEvent } from '@/services/analytics';

const NAV_LINKS = [
  { label: 'Início', href: '#inicio' },
  { label: 'Simulação', href: '#calculadora' },
  { label: 'Serviços', href: '#servicos' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Sobre', href: '#sobre' },
  { label: 'Dúvidas', href: '#faq' },
  { label: 'Contato', href: '#contato' },
];

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = () => setIsMenuOpen(false);

  const handleSimularClick = () => {
    trackEvent('click_simular', { origem: 'header' });
    setIsMenuOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        isScrolled ? 'bg-white/95 shadow-soft backdrop-blur' : 'bg-white/70 backdrop-blur-sm'
      }`}
    >
      <Container className="flex h-20 items-center justify-between">
        <a href="#inicio" className="flex flex-col leading-tight" onClick={handleNavClick}>
          <span className="text-lg font-extrabold tracking-tight text-navy-900 sm:text-xl">GABRIEL ZANELOTI</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-600 sm:text-xs">
            Planejamento Tributário | INSS de Obras
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-navy-600 transition-colors hover:text-navy-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a href="#calculadora" className="btn-primary hidden lg:inline-flex" onClick={handleSimularClick}>
          Simular agora
        </a>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-navy-900 lg:hidden"
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((prev) => !prev)}
        >
          {isMenuOpen ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </Container>

      {isMenuOpen && (
        <div className="border-t border-navy-100 bg-white lg:hidden animate-fade-in">
          <Container className="flex flex-col gap-1 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={handleNavClick}
                className="rounded-lg px-3 py-3 text-base font-medium text-navy-700 hover:bg-navy-50"
              >
                {link.label}
              </a>
            ))}
            <a href="#calculadora" className="btn-primary mt-2 w-full" onClick={handleSimularClick}>
              Simular agora
            </a>
          </Container>
        </div>
      )}
    </header>
  );
}
