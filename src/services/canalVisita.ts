/**
 * ============================================================================
 *  DE ONDE VEIO CADA VISITA (aba "Tráfego" do CRM)
 * ============================================================================
 * Junta referrer, UTMs, identificador de clique do Google Ads, código de
 * parceiro, a marca do aparelho do Gabriel e o navegador (user agent) num
 * único "canal" legível. As visitas gravadas antes da v50 não têm user agent
 * nem gclid: para elas, o Google aparece como "anúncio ou busca" e o resto
 * como "Direto / desconhecido (antes da v50)".
 * ============================================================================
 */
import type { PageView } from './crmService';

/** Navegadores automáticos: robôs de busca, prévias de link e testes (prints) do próprio site. */
const ROBO_RE =
  /bot\b|bot\/|crawler|spider|slurp|headless|lighthouse|pagespeed|google-inspectiontool|adsbot|mediapartners|facebookexternalhit|whatsapp\/|preview|python|curl|wget|node-fetch|axios|go-http|java\//i;

function host(referrer: string | null): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return referrer.toLowerCase();
  }
}

export function canalDaVisita(v: PageView): string {
  if (v.interno) return 'Você (Gabriel)';
  if (v.userAgent && ROBO_RE.test(v.userAgent)) return 'Robôs e testes automáticos';

  const fonte = (v.utmSource ?? '').toLowerCase();
  const meio = (v.utmMedium ?? '').toLowerCase();
  if (v.clickId || ['cpc', 'ppc', 'paid', 'pago'].includes(meio)) return 'Google Ads (anúncio)';
  if (fonte === 'lia') return 'WhatsApp da Lia';
  if (fonte === 'pdf') return 'PDF da simulação';
  if (fonte === 'perfil-google' || fonte === 'gbp') return 'Perfil no Google (Maps)';
  if (v.ref) return 'Link de parceiro';
  if (fonte === 'ig' || fonte.includes('instagram') || fonte.includes('facebook')) return 'Instagram / Facebook';
  if (fonte) return `Campanha: ${v.utmSource}`;

  const h = host(v.referrer);
  if (h) {
    if (h.endsWith('gabrielzaneloti.com.br')) return 'Dentro do próprio site';
    if (/googlesyndication|doubleclick|googleadservices/.test(h)) return 'Google Ads (anúncio)';
    if (h.includes('com.google.android.gm') || h.includes('mail.')) return 'E-mail';
    if (/(^|\.)google\./.test(h) || h.includes('com.google.android.googlequicksearchbox')) {
      return v.userAgent ? 'Google (busca grátis)' : 'Google (anúncio ou busca)';
    }
    if (/instagram|facebook|fb\.|l\.wl\.co/.test(h)) return 'Instagram / Facebook';
    if (/bing|yahoo|duckduckgo/.test(h)) return 'Outros buscadores';
    if (/chatgpt|openai|perplexity|gemini|copilot/.test(h)) return 'ChatGPT e outras IAs';
    if (h.includes('whatsapp')) return 'WhatsApp';
    return h;
  }

  return v.userAgent ? 'Direto (digitou, favorito ou link sem origem)' : 'Direto / desconhecido (antes da v50)';
}

/** Celular x computador, pela largura da tela (só nas visitas a partir da v50). */
export function aparelhoDaVisita(v: PageView): string | null {
  if (!v.tela) return null;
  return v.tela < 768 ? 'Celular' : v.tela < 1024 ? 'Tablet' : 'Computador';
}
