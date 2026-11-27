/**
 * Roda `fn` só depois que a página terminou de carregar e o navegador ficou livre.
 * Usado para os scripts de fora (Google, Clarity): eles não disputam a internet do celular com o topo do site.
 *
 * v49: NÃO carrega mais "no primeiro toque". Antes, o 1º toque do visitante (ex.: escolher Pessoa Física)
 * disparava a leitura de ~500 KB de scripts do Google e do Clarity no mesmo instante, e a tela demorava
 * para responder àquele toque (o Clarity mediu 700 ms). Agora eles carregam sempre depois do load,
 * num momento em que o navegador está parado. Nenhum evento se perde: tudo fica na fila (dataLayer / clarity.q).
 */
export function depoisDeCarregar(fn: () => void, atrasoMs = 1500): void {
  if (typeof window === 'undefined') return;
  let feito = false;
  const rodar = () => {
    if (feito) return;
    feito = true;
    fn();
  };
  const quandoLivre = () => {
    const w = window as typeof window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(rodar, { timeout: 3000 });
    else rodar();
  };
  const agendar = () => window.setTimeout(quandoLivre, atrasoMs);
  if (document.readyState === 'complete') agendar();
  else window.addEventListener('load', agendar, { once: true });
}

/**
 * Roda `fn` logo DEPOIS que a tela foi redesenhada. Usado para avisar o Google/Meta de um clique:
 * assim o botão responde na hora e o trabalho dos scripts de fora fica para o instante seguinte.
 * Se a pessoa sair da página antes (ex.: abriu o WhatsApp), o que estiver na fila é enviado na saída.
 */
const fila: Array<() => void> = [];
let ouvindoSaida = false;

function esvaziar(): void {
  while (fila.length) {
    const f = fila.shift()!;
    try {
      f();
    } catch {
      /* um script de fora com erro não pode travar o site */
    }
  }
}

export function depoisDoDesenho(fn: () => void): void {
  if (typeof window === 'undefined') return;
  fila.push(fn);
  if (!ouvindoSaida) {
    ouvindoSaida = true;
    window.addEventListener('pagehide', esvaziar);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') esvaziar();
    });
  }
  const depois = () => window.setTimeout(esvaziar, 0);
  if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') requestAnimationFrame(depois);
  else depois();
}
