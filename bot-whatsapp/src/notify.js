/**
 * Avisos para o Gabriel por e-mail (Resend), no mesmo e-mail que já recebe os leads do site.
 * Se RESEND_API_KEY não estiver configurada, só escreve no console.
 */

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function criarNotificador({ resendKey, para, fetchImpl = fetch, log = console }) {
  async function enviar(assunto, html) {
    if (!resendKey) {
      log.warn(`[aviso] (sem RESEND_API_KEY) ${assunto}`);
      return false;
    }
    try {
      const r = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Bot WhatsApp <onboarding@resend.dev>', to: [para], subject: assunto, html }),
      });
      if (!r.ok) {
        log.error(`[aviso] Resend recusou (${r.status}): ${(await r.text()).slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (e) {
      log.error('[aviso] falha ao enviar e-mail:', e.message);
      return false;
    }
  }

  /**
   * @param {object} p
   * @param {string} p.tipo        rótulo curto (ex.: "Passou para você", "Lead respondeu")
   * @param {object} p.lead
   * @param {string} p.telefone    dígitos com 55
   * @param {string} [p.motivo]
   * @param {Array<{direcao:string,texto:string}>} [p.historico]
   */
  async function avisar({ tipo, lead, telefone, motivo, historico = [] }) {
    const nome = lead?.nome || 'Lead';
    const link = telefone ? `https://wa.me/${telefone}` : null;
    const linhas = historico
      .slice(-10)
      .map((m) => {
        const quem = m.direcao === 'lead' ? esc(nome) : m.direcao === 'humano' ? 'Você' : 'Assistente';
        return `<p style="margin:0 0 6px;font-size:13px;"><strong>${quem}:</strong> ${esc(m.texto)}</p>`;
      })
      .join('');
    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#111827;">
        <h2 style="margin:0 0 6px;font-size:18px;">${esc(tipo)}: ${esc(nome)}</h2>
        ${motivo ? `<p style="margin:0 0 14px;font-size:14px;color:#374151;">${esc(motivo)}</p>` : ''}
        ${linhas ? `<div style="padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 14px;">${linhas}</div>` : ''}
        ${link ? `<a href="${link}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">Abrir conversa no WhatsApp</a>` : ''}
      </div>`;
    return enviar(`${tipo}: ${nome}`, html);
  }

  return { avisar, enviar };
}
