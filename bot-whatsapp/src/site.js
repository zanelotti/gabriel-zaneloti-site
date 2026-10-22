/**
 * Conversa com o site (as mesmas rotas que a página de agendamento usa):
 *   GET  /api/agenda-horarios  → horários livres
 *   POST /api/agendar          → marca a consultoria (cria evento no Google Agenda e avisa por e-mail)
 * Assim o bot respeita exatamente as regras de agenda do site (24h de antecedência,
 * 15 dias, 9h às 18h) sem duplicar nada.
 */
import { dataHoraBR, soDigitos } from './util.js';

const FUSO = 'America/Sao_Paulo';

function rotuloHorario(iso) {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit' }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} às ${hora}`;
}

export function criarSite({ siteUrl, fetchImpl = fetch }) {
  /** Devolve até ~9 horários bem espalhados (3 por dia, nos primeiros dias com vaga). */
  async function verHorarios() {
    const resp = await fetchImpl(`${siteUrl}/api/agenda-horarios`, { headers: { Accept: 'application/json' } });
    if (!resp.ok) return { ok: false, erro: `agenda indisponível (${resp.status})` };
    const dados = await resp.json();
    const opcoes = [];
    for (const dia of (dados.dias || []).slice(0, 4)) {
      const h = dia.horarios || [];
      if (h.length === 0) continue;
      const idx = [...new Set([0, Math.floor((h.length - 1) / 2), h.length - 1])];
      for (const i of idx) opcoes.push({ inicio: h[i].inicio, quando: rotuloHorario(h[i].inicio) });
    }
    if (opcoes.length === 0) return { ok: true, horarios: [], aviso: 'Nenhum horário livre nos próximos dias.' };
    return {
      ok: true,
      fuso: 'horário de Brasília',
      duracao_minutos: dados.duracaoMinutos,
      horarios: opcoes,
    };
  }

  async function agendar({ nome, email, whatsapp, inicio, observacoes }) {
    const tel = soDigitos(whatsapp).replace(/^55(?=\d{10,11}$)/, '');
    const resp = await fetchImpl(`${siteUrl}/api/agendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, whatsapp: tel, inicio, observacoes }),
    });
    let corpo = {};
    try {
      corpo = await resp.json();
    } catch {
      /* resposta sem JSON */
    }
    if (resp.ok && corpo.ok !== false) {
      return { ok: true, confirmado_para: dataHoraBR(inicio) };
    }
    const motivos = {
      slot_taken: 'Esse horário acabou de ser ocupado. Ofereça outro (use ver_horarios de novo).',
      invalid_slot: 'Esse horário não está entre os oferecidos. Use ver_horarios e escolha um deles.',
      invalid_email: 'O e-mail informado parece inválido. Peça o e-mail novamente.',
      invalid_whatsapp: 'O WhatsApp do lead não passou na validação do site. Use passar_para_gabriel.',
      invalid_nome: 'Nome inválido. Use passar_para_gabriel.',
      ja_agendado: `Essa pessoa já tem uma consultoria marcada${corpo.inicio ? ` para ${dataHoraBR(corpo.inicio)}` : ''}. Confirme esse horário com ela em vez de marcar outro.`,
    };
    return { ok: false, erro: motivos[corpo.reason] || `não foi possível agendar (${corpo.reason || resp.status})` };
  }

  return { verHorarios, agendar };
}
