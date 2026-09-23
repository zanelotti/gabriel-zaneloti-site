/**
 * ============================================================================
 *  CAPTURA DO "GUIA GRATUITO" (lead magnet)
 * ============================================================================
 * Mesmo espírito do `leadService.ts`: nunca trava a experiência do visitante.
 * O download do PDF acontece imediatamente ao enviar o formulário; a
 * notificação para o Gabriel (função serverless `/api/notify-guia-lead`) roda
 * em paralelo, fire-and-forget, e engole qualquer erro de rede.
 * ============================================================================
 */

export interface GuiaLeadInput {
  nome: string;
  whatsapp: string;
}

function notifyByEmail(input: GuiaLeadInput): void {
  if (typeof fetch === 'undefined') return;
  fetch('/api/notify-guia-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => {
    // Falha de rede, função ainda não configurada etc. — não deve impedir o
    // download do guia, que já aconteceu antes desta chamada.
  });
}

/** Dispara o download do PDF estático do guia gratuito. */
function downloadGuiaPdf(): void {
  const link = document.createElement('a');
  link.href = '/guia-gratuito-inss-obra.pdf';
  link.download = 'guia-5-erros-inss-de-obra.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const guiaLeadService = {
  /** Registra o interesse (best-effort) e dispara o download do guia. */
  capture(input: GuiaLeadInput): void {
    notifyByEmail(input);
    downloadGuiaPdf();
  },
};
