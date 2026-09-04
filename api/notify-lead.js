/**
 * ============================================================================
 *  FUNÇÃO SERVERLESS (Vercel) — NOTIFICAÇÃO POR E-MAIL DE NOVO LEAD
 * ============================================================================
 * Chamada pelo frontend (`leadService.ts`) toda vez que alguém termina uma
 * simulação no site. Envia um e-mail para o Gabriel com os dados preenchidos,
 * usando a API da Resend (https://resend.com).
 *
 * CONFIGURAÇÃO NECESSÁRIA (variáveis de ambiente no projeto Vercel):
 *   - RESEND_API_KEY          (obrigatória) — chave da conta Resend.
 *   - LEAD_NOTIFICATION_EMAIL (opcional)    — e-mail que recebe as notificações.
 *                                             Se não for definida, usa o padrão abaixo.
 *
 * Esta função NUNCA deve derrubar a captura do lead no site: qualquer erro
 * aqui é só registrado no log da Vercel (Vercel → projeto → Logs) — o
 * visitante nunca vê nada disso, e o lead já foi salvo antes desta chamada.
 * ============================================================================
 */

const DEFAULT_NOTIFICATION_EMAIL = 'comercial.mfzeng@gmail.com';

const RESPONSAVEL_LABEL = {
  PF: 'Pessoa Física',
  PJ: 'Pessoa Jurídica',
};

const TIPO_OBRA_LABEL = {
  alvenaria: 'Alvenaria',
  madeira: 'Madeira',
  mista: 'Mista',
};

const SITUACAO_LABEL = {
  concluida_com_habite_se: 'Concluída com Habite-se',
  concluida_sem_habite_se: 'Concluída sem Habite-se',
  em_construcao: 'Em construção',
  iniciar_em_breve: 'Iniciar em breve',
  construida_ha_mais_de_5_anos: 'Construída há mais de 5 anos',
};

const DESTINACAO_LABEL = {
  residencial_unifamiliar: 'Residencial unifamiliar',
  multifamiliar: 'Multifamiliar',
  comercial_salas_lojas: 'Comercial — salas e lojas',
  galpao_industrial: 'Galpão industrial',
  conjunto_habitacional: 'Conjunto habitacional',
  edificio_garagem: 'Edifício garagem',
};

const CATEGORIA_LABEL = {
  obra_nova: 'Obra nova',
  acrescimo: 'Acréscimo',
  reforma: 'Reforma',
  demolicao: 'Demolição',
};

const BRAZILIAN_STATES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não calculado';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não calculado';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

function formatDateBR(isoDate) {
  if (!isoDate) return 'Não informado';
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return 'Não informado';
  return `${day}/${month}/${year}`;
}

function formatArea(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Não informado';
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`;
}

function estadoLabel(uf) {
  if (!uf) return 'Não informado';
  const nome = BRAZILIAN_STATES[uf];
  return nome ? `${uf} — ${nome}` : uf;
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function buildWhatsAppLink(lead) {
  const digits = onlyDigits(lead.whatsapp);
  if (!digits) return null;
  // Assume DDD + número informados sem o 55 do Brasil, como o campo do site pede.
  const numero = digits.length <= 11 ? `55${digits}` : digits;
  const texto = `Olá, ${lead.nome || ''}! Vi que você simulou a redução do INSS da sua obra no meu site.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function buildEmailHtml(lead) {
  const linhaResultado =
    lead.inssEstimado === null
      ? '<p style="margin:0 0 16px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;">Não foi possível gerar uma estimativa automática para os dados informados — vale entrar em contato para entender o caso.</p>'
      : `
        <table role="presentation" width="100%" style="border-collapse:collapse;margin:0 0 20px;">
          <tr>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px 0 0 8px;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">INSS estimado antes</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatCurrency(lead.inssEstimado)}</div>
            </td>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:none;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Economia estimada</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatCurrency(lead.economiaEstimada)}</div>
            </td>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:none;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Redução</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatPercent(lead.percentualReducao)}</div>
            </td>
            <td style="padding:10px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:none;border-radius:0 8px 8px 0;">
              <div style="font-size:12px;color:#166534;text-transform:uppercase;letter-spacing:.03em;">Após redução</div>
              <div style="font-size:18px;font-weight:700;color:#14532d;">${formatCurrency(lead.valorAposReducao)}</div>
            </td>
          </tr>
        </table>`;

  const whatsappLink = buildWhatsAppLink(lead);

  const linhas = [
    ['Nome', lead.nome || 'Não informado'],
    ['WhatsApp', lead.whatsapp || 'Não informado'],
    ['Início da obra', formatDateBR(lead.dataInicio)],
    ['Fim da obra', formatDateBR(lead.dataFim)],
    ['Responsável', RESPONSAVEL_LABEL[lead.responsavel] || 'Não informado'],
    ['Tipo de obra', TIPO_OBRA_LABEL[lead.tipoObra] || 'Não informado'],
    ['Situação', SITUACAO_LABEL[lead.situacao] || 'Não informado'],
    ['Categoria da obra', CATEGORIA_LABEL[lead.categoria] || 'Não informado'],
    ['Estado', estadoLabel(lead.estado)],
    ['Destinação', DESTINACAO_LABEL[lead.destinacao] || 'Não informado'],
    ['Área principal', formatArea(lead.areaPrincipal)],
    ['Área complementar (piscina etc.)', formatArea(lead.areaPiscina)],
  ];

  if (lead.observacoes) {
    linhas.push(['Observações', lead.observacoes]);
  }

  const linhasHtml = linhas
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
      <h2 style="margin:0 0 4px;font-size:20px;">Nova simulação no site 🎯</h2>
      <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">${escapeHtml(lead.nome || 'Alguém')} acabou de preencher a calculadora de INSS de obras.</p>
      ${linhaResultado}
      <table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
        ${linhasHtml}
      </table>
      ${
        whatsappLink
          ? `<a href="${whatsappLink}" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">Chamar ${escapeHtml(lead.nome || 'lead')} no WhatsApp</a>`
          : ''
      }
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">Simulação recebida em ${new Date(lead.createdAt || Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário de Brasília).</p>
    </div>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Configuração ainda não feita — não é um erro do visitante, só ainda não
    // foi conectado. Registra no log para o Gabriel/eu percebermos.
    console.error('[notify-lead] RESEND_API_KEY não configurada no projeto Vercel.');
    res.status(200).json({ ok: false, reason: 'email_not_configured' });
    return;
  }

  const toEmail = process.env.LEAD_NOTIFICATION_EMAIL || DEFAULT_NOTIFICATION_EMAIL;

  let lead = req.body;
  if (typeof lead === 'string') {
    try {
      lead = JSON.parse(lead);
    } catch {
      res.status(400).json({ ok: false, reason: 'invalid_body' });
      return;
    }
  }
  if (!lead || typeof lead !== 'object') {
    res.status(400).json({ ok: false, reason: 'invalid_body' });
    return;
  }

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Simulador INSS de Obras <onboarding@resend.dev>',
        to: [toEmail],
        reply_to: toEmail,
        subject: `Nova simulação: ${lead.nome || 'Visitante do site'}`,
        html: buildEmailHtml(lead),
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('[notify-lead] Falha ao enviar via Resend:', resendResponse.status, errorText);
      res.status(200).json({ ok: false, reason: 'send_failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[notify-lead] Erro inesperado ao enviar e-mail:', error);
    res.status(200).json({ ok: false, reason: 'exception' });
  }
}
