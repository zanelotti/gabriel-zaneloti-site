/**
 * Mensagens automáticas do bot depois da abertura:
 *   - ACOMPANHAMENTO de quem parou de responder (24h, 3 dias e 7 dias);
 *   - LEMBRETES da consultoria (24h antes e 1h antes);
 *   - PÓS-CONSULTORIA (quando o Gabriel marca "Realizado" na aba Agenda do CRM);
 *   - NÃO COMPARECEU (quando o Gabriel marca "Não compareceu"): oferece remarcar.
 *
 * Os textos são modelos fixos (nada é inventado pelo Claude). Os únicos números
 * usados são os que o site já mostrou ao lead, e todo texto ainda passa por
 * `validarSaida` antes de sair.
 */
import { formatarReaisInteiros, primeiroNomePessoa } from './util.js';

const HORA = 3600 * 1000;
const FUSO = 'America/Sao_Paulo';

/** Quanto tempo depois da ÚLTIMA mensagem do bot (sem resposta do lead) sai cada acompanhamento: ~1 dia, ~3 dias, ~7 dias. */
export const ESPERA_FOLLOWUP_MS = [24 * HORA, 48 * HORA, 96 * HORA];
export const MAX_FOLLOWUPS = ESPERA_FOLLOWUP_MS.length;

/** Janela em que o bot pode mandar mensagens automáticas (horário de Brasília). */
export const JANELA_AUTOMATICA = { inicio: 8 * 60, fim: 20 * 60 };

export function horaDeBrasilia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(agora);
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function dentroDaJanelaAutomatica(agora = new Date()) {
  const t = horaDeBrasilia(agora);
  return t >= JANELA_AUTOMATICA.inicio && t < JANELA_AUTOMATICA.fim;
}

function saudacao(nome) {
  return nome ? `Oi, ${nome}!` : 'Oi!';
}

function nomeDe(lead, nomeContato) {
  return nomeContato || primeiroNomePessoa(lead?.nome) || '';
}

function economiaCitavel(lead) {
  if (lead?.responsavel === 'PJ') return null;
  const e = Number(lead?.economia_estimada);
  return Number.isFinite(e) && e > 0 ? formatarReaisInteiros(e) : null;
}

/**
 * @param {object} p
 * @param {object} p.lead
 * @param {1|2|3} p.nivel    qual acompanhamento (1 = 24h, 2 = 3 dias, 3 = 7 dias)
 * @param {boolean} p.respondeuAntes  o lead já tinha respondido alguma vez?
 * @param {string} [p.nomeContato]
 */
export function montarFollowup({ lead, nivel, respondeuAntes, nomeContato = '' }) {
  const oi = saudacao(nomeDe(lead, nomeContato));
  const eco = economiaCitavel(lead);
  if (nivel === 1) {
    if (respondeuAntes) return `${oi} Ficou alguma dúvida sobre o que conversamos? Se quiser, continuo de onde paramos.`;
    return eco
      ? `${oi} Só passando para ver se você conseguiu ler minha mensagem sobre o INSS da sua obra. A estimativa que o site mostrou indica uma economia de ${eco}. Posso te explicar de onde vem esse número?`
      : `${oi} Só passando para ver se você conseguiu ler minha mensagem sobre o INSS da sua obra. Posso te explicar como funciona a redução, sem compromisso?`;
  }
  if (nivel === 2) {
    const meio = eco
      ? `No seu caso a estimativa é de ${eco} de economia, e o saldo do INSS da obra ainda pode ser parcelado em até 60 vezes.`
      : 'O saldo do INSS da obra ainda pode ser parcelado em até 60 vezes.';
    return `${oi} Muita gente fica na dúvida se compensa mexer nisso. ${meio} Faz sentido a gente conversar uns minutinhos?`;
  }
  return `${oi} Como não tive retorno, devo entender que você desistiu de regularizar o INSS da sua obra? Se for só falta de tempo, sem problema: é só me chamar aqui que eu retomo de onde paramos.`;
}

/**
 * Qual acompanhamento está na hora de sair? (null = nenhum)
 * @param {object} p
 * @param {number} p.nivelAtual         acompanhamentos já enviados desde a última resposta do lead
 * @param {string} p.ultimaDirecao      direção da última mensagem da conversa ('bot' | 'lead' | 'humano')
 * @param {string|number|Date} p.ultimaEm   quando foi a última mensagem
 */
export function proximoFollowup({ nivelAtual = 0, ultimaDirecao, ultimaEm, agora = Date.now() }) {
  if (ultimaDirecao !== 'bot') return null; // o lead está esperando resposta, ou o Gabriel falou por último
  if (nivelAtual >= MAX_FOLLOWUPS) return null;
  const t = new Date(ultimaEm).getTime();
  if (!Number.isFinite(t)) return null;
  return agora - t >= ESPERA_FOLLOWUP_MS[nivelAtual] ? nivelAtual + 1 : null;
}

// ------------------------------------------------------------------------- consultoria

function partesData(data) {
  const f = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const o = {};
  for (const p of f.formatToParts(data)) o[p.type] = p.value;
  return o;
}

function chaveDia(data) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(data); // AAAA-MM-DD
}

export function horaCurta(data) {
  const p = partesData(data);
  return p.minute === '00' ? `${Number(p.hour)}h` : `${Number(p.hour)}h${p.minute}`;
}

/** "hoje às 12h", "amanhã às 12h" ou "sábado, 24/10, às 12h" (horário de Brasília). */
export function descreverQuando(inicio, agora = new Date()) {
  const d = new Date(inicio);
  const dia = chaveDia(d);
  if (dia === chaveDia(agora)) return `hoje às ${horaCurta(d)}`;
  if (dia === chaveDia(new Date(agora.getTime() + 24 * HORA))) return `amanhã às ${horaCurta(d)}`;
  const p = partesData(d);
  return `${p.weekday}, ${p.day}/${p.month}, às ${horaCurta(d)}`;
}

const DADOS_CONTRATO_PF = 'nome completo, CPF, endereço e e-mail';

/**
 * @param {'24h'|'1h'|'pos'|'faltou'} tipo
 */
export function montarMensagemConsultoria({ tipo, lead, inicio, nomeContato = '', agora = new Date() }) {
  const oi = saudacao(nomeDe(lead, nomeContato));
  if (tipo === '24h') {
    return `${oi} Passando para lembrar da nossa consultoria gratuita ${descreverQuando(inicio, agora)} (horário de Brasília). Se puder, deixe à mão o alvará, o projeto e o habite-se, se já tiver: ajuda a gente a avançar mais rápido. Se tiver qualquer imprevisto, me avisa por aqui que eu remarco.`;
  }
  if (tipo === '1h') {
    return `${oi} Daqui a pouco, às ${horaCurta(new Date(inicio))}, é a nossa consultoria gratuita. Se precisar de qualquer coisa ou não conseguir participar, me avisa por aqui.`;
  }
  if (tipo === 'pos') {
    const dados = lead?.responsavel === 'PJ'
      ? 'é só me avisar que eu peço os dados para preparar o contrato'
      : `é só me enviar ${DADOS_CONTRATO_PF}`;
    return `${oi} Foi um prazer conversar com você. Ficou alguma dúvida sobre o que o Gabriel explicou? Se quiser seguir com a regularização, já deixo o contrato pronto: ${dados}.`;
  }
  return `${oi} Vi que não conseguimos nos falar na consultoria. Imprevistos acontecem! Quer que eu veja um novo horário para você?`;
}

/**
 * Qual mensagem da consultoria está na hora de sair para este agendamento? (null = nenhuma)
 * Cada tipo sai no máximo uma vez (o chamador guarda o que já foi enviado).
 */
export function lembreteDevido({ status, inicio, fim, criadoEm, agora = Date.now() }) {
  const ini = new Date(inicio).getTime();
  const fi = new Date(fim).getTime();
  if (!Number.isFinite(ini) || !Number.isFinite(fi)) return [];
  const devidos = [];
  if (status === 'agendado') {
    const falta = ini - agora;
    const recente = agora - new Date(criadoEm).getTime() < 12 * HORA; // acabou de marcar: a confirmação já serve
    if (falta > 3 * HORA && falta <= 24 * HORA && !recente) devidos.push('24h');
    if (falta > 5 * 60 * 1000 && falta <= 75 * 60 * 1000) devidos.push('1h');
  }
  if (status === 'realizado' && agora >= fi + 20 * 60 * 1000 && agora <= fi + 48 * HORA) devidos.push('pos');
  if (status === 'nao_compareceu' && agora >= ini && agora <= fi + 48 * HORA) devidos.push('faltou');
  return devidos;
}
