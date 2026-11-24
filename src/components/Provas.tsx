import { useEffect, useRef, useState } from 'react';
import { CREDENCIAIS } from '@/data/credenciais';
import { AVALIACOES, type Avaliacao } from '@/data/avaliacoes';
import { trackEvent } from '@/services/analytics';
import { ECONOMIA_TOTAL_TEXTO } from '@/data/resultados';

function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

function Cartao({ a }: { a: Avaliacao }) {
  const [inteiro, setInteiro] = useState(false);
  const longo = a.texto.length > 150;
  return (
    <li className="flex w-[85%] shrink-0 snap-start flex-col rounded-lg bg-white p-4 sm:w-[70%]">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-navy-900">{a.nome}</p>
        <LogoGoogle />
      </div>
      <p className="mt-0.5 flex items-center gap-2 text-xs text-navy-400">
        <span className="tracking-tight text-amber-500" aria-label="5 estrelas">★★★★★</span>
        {a.quando}
      </p>
      <p className={`mt-2 text-sm leading-relaxed text-navy-700 ${inteiro ? '' : 'line-clamp-4'}`}>{a.texto}</p>
      {longo && (
        <button type="button" onClick={() => setInteiro((v) => !v)} className="mt-1 self-start text-xs font-semibold text-navy-500 underline">
          {inteiro ? 'Ler menos' : 'Ler mais'}
        </button>
      )}
    </li>
  );
}

/**
 * Topo do site, ao lado da calculadora: as avaliações reais do Google (copiadas em data/avaliacoes.ts),
 * em cartões que deslizam para o lado, e o link para ver todas no Google. Embaixo, os números e o CNPJ.
 * Tudo vem junto com a página: não depende de serviço de fora e não faz a página "pular".
 */
export function Provas() {
  const { googleAvaliacoes, googleNota, cnpj, registro } = CREDENCIAIS;
  const trilho = useRef<HTMLUListElement>(null);
  const parado = useRef(false);
  const ate = useRef(0);

  // Vai para o próximo cartão (ou volta); no fim, recomeça do primeiro.
  const andar = (direcao: 1 | -1) => {
    const el = trilho.current;
    if (!el) return;
    const passo = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    const fim = el.scrollWidth - el.clientWidth - 4;
    if (direcao === 1 && el.scrollLeft >= fim) el.scrollTo({ left: 0 });
    else if (direcao === -1 && el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth });
    else el.scrollBy({ left: direcao * (passo + 12) });
  };

  // Quem mexe nas avaliações ganha 10 s de pausa antes de voltarem a andar sozinhas.
  const pausar = () => {
    ate.current = Date.now() + 10000;
  };

  // Passa sozinho a cada 5 s (só quando o quadro está na tela e a aba está aberta).
  useEffect(() => {
    let visivel = false;
    const el = trilho.current;
    const obs = el && 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => (visivel = e.isIntersecting)) : null;
    if (el && obs) obs.observe(el);
    else visivel = true;
    const t = window.setInterval(() => {
      if (visivel && !parado.current && Date.now() > ate.current && !document.hidden) andar(1);
    }, 5000);
    return () => {
      window.clearInterval(t);
      obs?.disconnect();
    };
  }, []);

  return (
    <div className="min-w-0 max-w-full rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">O que os clientes dizem</p>
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
          <span className="text-amber-400" aria-hidden="true">★</span>
          {googleNota || '5,0'} no Google
        </p>
      </div>

      <div className="relative mt-3">
        <ul
          ref={trilho}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Avaliações de clientes no Google"
          onPointerDown={pausar}
          onMouseEnter={() => (parado.current = true)}
          onMouseLeave={() => (parado.current = false)}
        >
          {AVALIACOES.map((a) => (
            <Cartao key={a.nome} a={a} />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => { pausar(); andar(-1); }}
          aria-label="Avaliação anterior"
          className="absolute -left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg font-bold text-navy-800 shadow-card"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => { pausar(); andar(1); }}
          aria-label="Próxima avaliação"
          className="absolute -right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg font-bold text-navy-800 shadow-card"
        >
          ›
        </button>
      </div>

      {googleAvaliacoes && (
        <div className="mt-2 text-right text-xs">
          <a
            href={googleAvaliacoes}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent-300 underline-offset-4 hover:underline"
            onClick={() => trackEvent('click_avaliacoes_google', { origem: 'hero' })}
          >
            Ver todas no Google
          </a>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li>
          <span className="whitespace-nowrap font-bold text-accent-300">{ECONOMIA_TOTAL_TEXTO}</span>{' '}
          <span className="text-navy-200">economizados para clientes</span>
        </li>
        {cnpj && (
          <li className="text-navy-200">
            CNPJ <span className="font-semibold text-white">{cnpj}</span>
          </li>
        )}
        {registro && <li className="font-semibold text-white">{registro}</li>}
      </ul>
    </div>
  );
}
