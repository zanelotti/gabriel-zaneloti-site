import { useEffect, useRef, useState } from 'react';
import { CREDENCIAIS } from '@/data/credenciais';
import { trackEvent } from '@/services/analytics';

/** Aceita o código inteiro do Trustindex (<script ... loader.js?ID>) ou só o ID. */
export function idDoTrustindex(codigo: string): string {
  const t = codigo.trim();
  const m = t.match(/loader\.js\?([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]+$/.test(t) ? t : '';
}

/**
 * Topo do site, ao lado da calculadora: as avaliações reais do Google (quadro do Trustindex, que atualiza sozinho),
 * pequeno, com o botão "Ver maior" que abre em tela cheia. Embaixo, os números e o CNPJ.
 * Há UM quadro só na página (o mesmo elemento muda de tamanho), para o Trustindex não carregar duas vezes.
 */
export function Provas() {
  const { googleAvaliacoes, googleNota, googleQuantidade, cnpj, registro } = CREDENCIAIS;
  const id = idDoTrustindex(CREDENCIAIS.trustindex);
  const caixa = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);

  // Coloca o script do Trustindex uma vez: ele desenha o quadro no lugar do script.
  useEffect(() => {
    const alvo = caixa.current;
    if (!id || !alvo || alvo.childElementCount > 0) return;
    const script = document.createElement('script');
    script.src = `https://cdn.trustindex.io/loader.js?${id}`;
    script.async = true;
    script.defer = true;
    alvo.appendChild(script);
  }, [id]);

  // Abriu/fechou: trava a rolagem da página, fecha com Esc e avisa o quadro para se reajustar ao novo tamanho.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    if (!aberto) return () => window.clearTimeout(t);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('keydown', tecla);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = antes;
      window.removeEventListener('keydown', tecla);
    };
  }, [aberto]);

  const textoGoogle = googleNota
    ? `${googleNota} no Google${googleQuantidade ? ` · ${googleQuantidade} avaliações` : ''}`
    : 'Avaliações de clientes no Google';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy-300">O que os clientes dizem</p>
        {googleAvaliacoes && (
          <a
            href={googleAvaliacoes}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 hover:underline"
            onClick={() => trackEvent('click_avaliacoes_google', { origem: 'hero' })}
          >
            <span className="text-amber-400" aria-hidden="true">★</span>
            {textoGoogle}
          </a>
        )}
      </div>

      {id && (
        <>
          {/* Fundo escuro do modo "ver maior" (clicar fora fecha) */}
          {aberto && (
            <div className="fixed inset-0 z-[60] bg-navy-950/80" onClick={() => setAberto(false)} aria-hidden="true" />
          )}
          <div
            role={aberto ? 'dialog' : undefined}
            aria-modal={aberto ? true : undefined}
            aria-label={aberto ? 'Avaliações no Google' : undefined}
            className={
              aberto
                ? 'fixed inset-x-3 top-1/2 z-[61] mx-auto max-h-[90vh] max-w-5xl -translate-y-1/2 overflow-auto rounded-xl2 bg-white p-4 shadow-card sm:inset-x-6 sm:p-6'
                : 'relative mt-3 max-h-[17rem] overflow-hidden rounded-lg bg-white p-2'
            }
          >
            {aberto && (
              <div className="mb-3 flex items-center justify-between">
                <p className="text-base font-bold text-navy-900">Avaliações no Google</p>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-full px-3 py-1 text-sm font-semibold text-navy-600 hover:bg-navy-50"
                >
                  Fechar ✕
                </button>
              </div>
            )}
            <div ref={caixa} className="provas-trustindex" />
            {!aberto && (
              <button
                type="button"
                onClick={() => {
                  setAberto(true);
                  trackEvent('click_avaliacoes_google', { origem: 'hero_ver_maior' });
                }}
                className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-white via-white/90 to-transparent pb-2 text-sm font-semibold text-navy-800"
              >
                Ver maior ⤢
              </button>
            )}
          </div>
        </>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <li>
          <span className="whitespace-nowrap font-bold text-accent-300">R$ 1,09 mi</span>{' '}
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
