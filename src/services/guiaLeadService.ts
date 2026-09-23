/**
 * ============================================================================
 *  CAPTURA DE "GUIAS GRATUITOS" (lead magnets)
 * ============================================================================
 * Mesmo espírito do `leadService.ts`: nunca trava a experiência do visitante.
 * O download do PDF acontece imediatamente ao enviar o formulário; a
 * notificação para o Gabriel (função serverless `/api/notify-guia-lead`) roda
 * em paralelo, fire-and-forget, e engole qualquer erro de rede.
 *
 * Preparado para atender mais de um material ao mesmo tempo (basta acrescentar
 * uma entrada em `GUIAS`); o campo `material` é gravado junto no Supabase
 * para diferenciar de qual PDF veio cada contato.
 * ============================================================================
 */

export type GuiaMaterial = 'guia-caminho-regularizacao';

export interface GuiaLeadInput {
  nome: string;
  email: string;
  whatsapp: string;
  material?: GuiaMaterial;
}

interface GuiaConfig {
  pdfHref: string;
  pdfDownloadName: string;
}

const GUIAS: Record<GuiaMaterial, GuiaConfig> = {
  'guia-caminho-regularizacao': {
    pdfHref: '/guia-caminho-regularizacao.pdf',
    pdfDownloadName: 'o-caminho-da-regularizacao.pdf',
  },
};

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

/** Dispara o download do PDF estático correspondente ao material escolhido. */
function downloadGuiaPdf(material: GuiaMaterial): void {
  const { pdfHref, pdfDownloadName } = GUIAS[material];
  const link = document.createElement('a');
  link.href = pdfHref;
  link.download = pdfDownloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export const guiaLeadService = {
  /** Registra o interesse (best-effort) e dispara o download do guia. */
  capture(input: GuiaLeadInput): void {
    const material = input.material ?? 'guia-caminho-regularizacao';
    notifyByEmail({ ...input, material });
    downloadGuiaPdf(material);
  },
};
