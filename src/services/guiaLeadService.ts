/**
 * ============================================================================
 *  CAPTURA DE "GUIAS GRATUITOS" (lead magnets)
 * ============================================================================
 * Mesmo espírito do `leadService.ts`: nunca trava a experiência do visitante.
 * O download do PDF acontece imediatamente ao enviar o formulário; a
 * notificação para o Gabriel (função serverless `/api/notify-guia-lead`) roda
 * em paralelo, fire-and-forget, e engole qualquer erro de rede.
 *
 * Um único serviço atende os dois materiais hoje disponíveis (identificados
 * pelo campo `material`, gravado junto no Supabase para diferenciar de qual
 * PDF veio cada contato).
 * ============================================================================
 */

export type GuiaMaterial = 'guia-5-erros' | 'guia-caminho-regularizacao';

export interface GuiaLeadInput {
  nome: string;
  whatsapp: string;
  material?: GuiaMaterial;
}

interface GuiaConfig {
  pdfHref: string;
  pdfDownloadName: string;
}

const GUIAS: Record<GuiaMaterial, GuiaConfig> = {
  'guia-5-erros': {
    pdfHref: '/guia-gratuito-inss-obra.pdf',
    pdfDownloadName: 'guia-5-erros-inss-de-obra.pdf',
  },
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
    const material = input.material ?? 'guia-5-erros';
    notifyByEmail({ ...input, material });
    downloadGuiaPdf(material);
  },
};
