/**
 * Roda `fn` só depois que a página terminou de carregar e o navegador ficou livre
 * (ou na primeira interação do visitante, o que vier antes). Usado para os scripts
 * de fora (Google, Clarity): eles não disputam a internet do celular com o topo do site.
 */
export function depoisDeCarregar(fn: () => void, atrasoMs = 1500): void {
  if (typeof window === 'undefined') return;
  let feito = false;
  const rodar = () => {
    if (feito) return;
    feito = true;
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.removeEventListener(e, rodar));
    fn();
  };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((e) => window.addEventListener(e, rodar, { once: true, passive: true }));
  const agendar = () => window.setTimeout(rodar, atrasoMs);
  if (document.readyState === 'complete') agendar();
  else window.addEventListener('load', agendar, { once: true });
}
