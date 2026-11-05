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
 *
 * Material atual: e-book "Como reduzir o INSS da sua obra"
 * (`public/ebook-reduzir-inss-obra.pdf`). O material antigo
 * ('guia-caminho-regularizacao') continua na lista só para que os contatos
 * já gravados no CRM sigam com o nome certo.
 * ============================================================================
 */

export type GuiaMaterial = 'ebook-reduzir-inss-obra' | 'guia-caminho-regularizacao';

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

export const GUIA_PADRAO: GuiaMaterial = 'ebook-reduzir-inss-obra';

const GUIAS: Record<GuiaMaterial, GuiaConfig> = {
  'ebook-reduzir-inss-obra': {
    pdfHref: '/ebook-reduzir-inss-obra.pdf',
    pdfDownloadName: 'ebook-como-reduzir-o-inss-da-sua-obra.pdf',
  },
  'guia-caminho-regularizacao': {
    pdfHref: '/ebook-reduzir-inss-obra.pdf',
    pdfDownloadName: 'ebook-como-reduzir-o-inss-da-sua-obra.pdf',
  },
};

/** Endereço e nome do arquivo do PDF — usados também pelo botão "Baixar e-book". */
export function getGuiaDownload(material: GuiaMaterial = GUIA_PADRAO): GuiaConfig {
  return GUIAS[material];
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
    const material = input.material ?? GUIA_PADRAO;
    notifyByEmail({ ...input, material });
    downloadGuiaPdf(material);
  },
};
