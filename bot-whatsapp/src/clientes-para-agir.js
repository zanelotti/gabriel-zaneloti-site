/**
 * "Clientes para agir" (pedido do Gabriel, 26/11/2026): a Lia lê as conversas abertas e diz
 * quais clientes têm chance de fechar, em quais o Gabriel precisa fazer algo e o que fazer.
 *
 * Usado de dois jeitos:
 *   - todo dia às 8h (horário de Brasília) vai por e-mail para o Gabriel (ver index.js);
 *   - na hora, pelo botão "Clientes para agir" do Painel (scripts/clientes-para-agir.js).
 *
 * Só LÊ: não muda card, não manda mensagem para cliente.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FUSO = 'America/Sao_Paulo';
const DIA = 24 * 3600 * 1000;
/** Conversas sem nenhuma mensagem há mais tempo que isto ficam de fora (já esfriaram). */
export const DIAS_MAXIMOS = 45;
const CACHE_PADRAO = '/root/clientes-para-agir-cache.json';

const ROTULO = {
  novo: 'Novo',
  contatado: 'Contatado',
  sem_resposta: 'Sem resposta',
  proposta_enviada: 'Proposta enviada',
  decidindo: 'Decidindo',
  agendado: 'Agendamento',
  fechado: 'Fechado',
  perdido: 'Perdido',
};
export const CHANCES = ['alta', 'media', 'baixa', 'nenhuma'];
const ORDEM_CHANCE = { alta: 0, media: 1, baixa: 2, nenhuma: 3 };
const ORDEM_URGENCIA = { hoje: 0, esta_semana: 1, nao: 2 };

const quem = (d) => ({ lead: 'CLIENTE', bot: 'LIA (assistente)', humano: 'GABRIEL' }[d] || d);
const quando = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** "2026-11-26" no horário de Brasília. */
export function diaDeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function instrucoes(agora = new Date()) {
  return `Você é a Lia, assistente de vendas do Gabriel Zaneloti, especialista em redução de INSS de obra (pessoa física e empresa).
Leia a conversa de WhatsApp com um cliente e diga ao Gabriel, de forma bem direta:
1) a CHANCE de este cliente fechar contrato:
   - alta: mostrou interesse claro (pediu contrato ou lista de dados, mandou documentos, perguntou forma de pagamento, disse que vai fechar, tem consultoria marcada).
   - media: está engajado e tirando dúvidas, recebeu a simulação ou o preço e não recusou.
   - baixa: respostas frias, sumiu depois da simulação ou do preço, achou caro mas não encerrou.
   - nenhuma: recusou, já resolveu, vai fazer sozinho, pediu para parar ou nunca respondeu.
2) se o GABRIEL precisa fazer algo (precisa_de_voce = true) ou se a Lia dá conta sozinha (false). Precisa do Gabriel quando:
   - o cliente fez uma pergunta ou mandou algo e ninguém respondeu (principalmente se a Lia está calada nesta conversa);
   - o cliente quer fechar, pediu contrato, mandou dados ou documentos, ou quer falar com o Gabriel;
   - existe objeção que só o Gabriel resolve (desconto, caso técnico diferente, desconfiança);
   - a conversa está parada com chance alta ou média e vale uma mensagem pessoal do Gabriel ou uma ligação.
   Não precisa do Gabriel quando a Lia está conduzindo bem, quando a última mensagem foi da Lia há pouco tempo (ela ainda manda os lembretes de 1, 3 e 7 dias), ou quando a chance é nenhuma.
3) URGÊNCIA: hoje (cliente esperando resposta, ou quente e pode esfriar), esta_semana, ou nao.
4) O QUE FAZER: uma frase prática, começando com verbo, dizendo exatamente o que o Gabriel deve fazer ou mandar (ex.: "Mande o contrato e a lista de documentos", "Ligue e explique o parcelamento em 60x", "Responda a dúvida sobre o habite-se").
Regras do negócio: honorário de pessoa física é 12% da economia (mínimo R$ 800); empresa R$ 1.000 + 12% da economia; pagamento à vista, 50% no início e 50% no fim, ou cartão em até 6x sem juros. Parcelamento do INSS em até 60x só para meses já em atraso.
Não invente fatos que não estão na conversa. Hoje é ${new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'full', timeStyle: 'short' }).format(agora)}.
Responda SÓ com um JSON, sem texto fora dele:
{"chance": "alta|media|baixa|nenhuma", "precisa_de_voce": true|false, "urgencia": "hoje|esta_semana|nao", "o_que_fazer": "<uma frase>", "por_que": "<uma frase curta: em que ponto a conversa está>"}`;
}

function dadosDoLead(lead, conversa, agora) {
  const brl = (v) => (Number(v) > 0 ? `R$ ${Math.round(Number(v)).toLocaleString('pt-BR')}` : '');
  const linhas = [
    `Coluna atual no quadro: ${ROTULO[lead.status] || lead.status || 'Novo'}`,
    lead.responsavel ? `Responsável pela obra: ${lead.responsavel === 'PJ' ? 'empresa' : 'pessoa física'}` : '',
    brl(lead.inss_estimado) ? `INSS estimado sem planejamento: ${brl(lead.inss_estimado)}` : '',
    brl(lead.economia_estimada) ? `Economia estimada: ${brl(lead.economia_estimada)}` : '',
    conversa.estado === 'humano'
      ? 'ATENÇÃO: a Lia está CALADA nesta conversa (passou para o Gabriel ou o Gabriel assumiu). Só o Gabriel responde.'
      : conversa.estado === 'encerrada'
        ? 'A conversa foi encerrada pela Lia.'
        : 'A Lia está conduzindo esta conversa.',
    conversa.agendou_em ? `Consultoria marcada para ${quando(conversa.agendou_em)}.` : '',
    conversa.observacao ? `Observação: ${conversa.observacao}` : '',
  ];
  const ultima = conversa._ultima;
  if (ultima) linhas.push(`Última mensagem: ${quem(ultima.direcao)}, há ${Math.max(0, Math.floor((agora - new Date(ultima.criado_em)) / DIA))} dia(s).`);
  return linhas.filter(Boolean).join('\n');
}

export function lerResposta(bruto) {
  const json = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1));
  if (!CHANCES.includes(json.chance)) throw new Error(`chance inválida: ${json.chance}`);
  return {
    chance: json.chance,
    precisa_de_voce: json.precisa_de_voce === true && json.chance !== 'nenhuma',
    urgencia: json.urgencia in ORDEM_URGENCIA ? json.urgencia : 'nao',
    o_que_fazer: String(json.o_que_fazer || '').trim(),
    por_que: String(json.por_que || '').trim(),
  };
}

async function classificar({ anthropic, modelo, lead, conversa, msgs, agora }) {
  const texto = msgs.map((m) => `[${quando(m.criado_em)}] ${quem(m.direcao)}: ${String(m.texto || '').slice(0, 800)}`).join('\n');
  const r = await anthropic.messages.create({
    model: modelo,
    max_tokens: 400,
    system: instrucoes(agora),
    messages: [{ role: 'user', content: `${dadosDoLead(lead, conversa, agora)}\n\nCONVERSA:\n${texto}` }],
  });
  return lerResposta(r.content.filter((c) => c.type === 'text').map((c) => c.text).join(''));
}

function checar({ data, error }, ctx) {
  if (error) throw new Error(`Supabase (${ctx}): ${error.message}`);
  return data;
}

function lerCache(arquivo) {
  try {
    return existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {};
  } catch {
    return {};
  }
}

/**
 * Lê as conversas e devolve a lista analisada.
 * @param {object} p
 * @param {object} p.db         cliente do Supabase
 * @param {object} p.anthropic  cliente da Anthropic
 * @param {string} p.modelo
 * @returns {Promise<{itens: object[], analisadas: number, erros: number}>}
 */
export async function analisarClientes({ db, anthropic, modelo, agora = new Date(), cacheArquivo = CACHE_PADRAO, log = console }) {
  const leads = checar(await db.from('leads').select('*').not('status', 'in', '("fechado","perdido")'), 'leads');
  const conversas = checar(await db.from('bot_conversas').select('*').neq('estado', 'optout'), 'conversas');
  const porLead = new Map(conversas.map((c) => [c.lead_id, c]));
  const alvos = leads.filter((l) => porLead.has(l.id));
  const cache = lerCache(cacheArquivo);
  const novoCache = {};
  const dia = diaDeBrasilia(agora);
  const itens = [];
  let i = 0;
  let erros = 0;
  let analisadas = 0;

  async function trabalhador() {
    while (i < alvos.length) {
      const lead = alvos[i++];
      const conversa = porLead.get(lead.id);
      try {
        const msgs = (
          checar(
            await db.from('bot_mensagens').select('id,direcao,texto,criado_em').eq('conversa_id', conversa.id).order('criado_em', { ascending: false }).limit(60),
            'mensagens'
          ) || []
        ).reverse();
        if (!msgs.length) continue;
        const ultima = msgs[msgs.length - 1];
        if (agora - new Date(ultima.criado_em) > DIAS_MAXIMOS * DIA) continue;
        if (!msgs.some((m) => m.direcao === 'lead')) continue; // cliente nunca respondeu: nada a analisar
        conversa._ultima = ultima;
        analisadas++;
        const chave = `${ultima.id}|${conversa.estado}|${lead.status}|${dia}`;
        let r = cache[conversa.id]?.chave === chave ? cache[conversa.id].r : null;
        if (!r) r = await classificar({ anthropic, modelo, lead, conversa, msgs, agora });
        novoCache[conversa.id] = { chave, r };
        itens.push({
          ...r,
          nome: lead.nome || '(sem nome)',
          telefone: String(conversa.telefone || lead.whatsapp || '').replace(/\D/g, ''),
          coluna: ROTULO[lead.status] || 'Novo',
          diasParado: Math.max(0, Math.floor((agora - new Date(ultima.criado_em)) / DIA)),
          ultimaDoCliente: ultima.direcao === 'lead',
        });
      } catch (e) {
        erros++;
        log.warn?.(`  (não consegui analisar ${lead.nome || lead.id}: ${e.message})`);
      }
    }
  }
  await Promise.all([1, 2, 3, 4].map(trabalhador));
  try {
    writeFileSync(cacheArquivo, JSON.stringify(novoCache));
  } catch {
    /* sem cache: tudo bem */
  }
  return { itens: ordenar(itens), analisadas, erros };
}

export function ordenar(itens) {
  return [...itens].sort(
    (a, b) =>
      (ORDEM_URGENCIA[a.urgencia] ?? 9) - (ORDEM_URGENCIA[b.urgencia] ?? 9) ||
      (ORDEM_CHANCE[a.chance] ?? 9) - (ORDEM_CHANCE[b.chance] ?? 9) ||
      a.diasParado - b.diasParado
  );
}

/** Separa a lista nos três blocos do resumo. */
export function separar(itens) {
  const voce = itens.filter((x) => x.precisa_de_voce);
  const lia = itens.filter((x) => !x.precisa_de_voce && (x.chance === 'alta' || x.chance === 'media'));
  const resto = itens.filter((x) => !x.precisa_de_voce && (x.chance === 'baixa' || x.chance === 'nenhuma'));
  return { voce, lia, resto };
}

const CHANCE_TXT = { alta: 'chance ALTA', media: 'chance média', baixa: 'chance baixa', nenhuma: 'sem chance' };
const URG_TXT = { hoje: 'HOJE', esta_semana: 'esta semana', nao: '' };

export function formatarTelefone(t) {
  const d = String(t || '').replace(/\D/g, '');
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

const parado = (x) => (x.diasParado === 0 ? 'falou hoje' : x.diasParado === 1 ? 'parado há 1 dia' : `parado há ${x.diasParado} dias`);

/** Texto para a parte preta do Painel. */
export function montarTexto({ itens, analisadas, erros = 0 }) {
  const { voce, lia, resto } = separar(itens);
  const l = [];
  l.push(`Li ${analisadas} conversa(s) dos últimos ${DIAS_MAXIMOS} dias.`);
  l.push('');
  l.push(`PRECISAM DE VOCÊ (${voce.length}):`);
  if (!voce.length) l.push('  Nenhum cliente esperando por você agora.');
  voce.forEach((x, n) => {
    l.push(`${n + 1}. ${x.nome} - ${formatarTelefone(x.telefone)} - ${CHANCE_TXT[x.chance]}${URG_TXT[x.urgencia] ? ` - fazer ${URG_TXT[x.urgencia]}` : ''}`);
    l.push(`   O que fazer: ${x.o_que_fazer}`);
    l.push(`   Por quê: ${x.por_que} (${parado(x)}${x.ultimaDoCliente ? ', a última mensagem é do cliente' : ''})`);
  });
  l.push('');
  l.push(`BOA CHANCE, A LIA ESTÁ CUIDANDO (${lia.length}):`);
  if (!lia.length) l.push('  Nenhum.');
  for (const x of lia) l.push(`- ${x.nome} - ${formatarTelefone(x.telefone)} - ${CHANCE_TXT[x.chance]}: ${x.por_que}`);
  l.push('');
  l.push(`POUCA OU NENHUMA CHANCE: ${resto.length} conversa(s), não precisa fazer nada.`);
  if (erros) l.push(`(${erros} conversa(s) não consegui ler desta vez.)`);
  return l.join('\n');
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** E-mail das 8h. */
export function montarEmail({ itens, analisadas, erros = 0 }, agora = new Date()) {
  const { voce, lia, resto } = separar(itens);
  const data = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' }).format(agora);
  const botao = (t) =>
    t ? `<a href="https://wa.me/${esc(t)}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:6px 12px;border-radius:6px;">Abrir no WhatsApp</a>` : '';
  const cartoes = voce
    .map(
      (x, n) => `
      <div style="border:1px solid #e5e7eb;border-left:4px solid ${x.urgencia === 'hoje' ? '#dc2626' : '#f59e0b'};border-radius:8px;padding:12px;margin:0 0 10px;">
        <p style="margin:0 0 4px;font-size:15px;"><strong>${n + 1}. ${esc(x.nome)}</strong> <span style="color:#6b7280;">${esc(formatarTelefone(x.telefone))}</span></p>
        <p style="margin:0 0 6px;font-size:12px;color:#6b7280;">${esc(CHANCE_TXT[x.chance])}${URG_TXT[x.urgencia] ? ` · fazer ${esc(URG_TXT[x.urgencia])}` : ''} · ${esc(parado(x))} · coluna ${esc(x.coluna)}</p>
        <p style="margin:0 0 4px;font-size:14px;"><strong>O que fazer:</strong> ${esc(x.o_que_fazer)}</p>
        <p style="margin:0 0 8px;font-size:13px;color:#374151;">${esc(x.por_que)}</p>
        ${botao(x.telefone)}
      </div>`
    )
    .join('');
  const listaLia = lia.map((x) => `<li style="margin:0 0 4px;"><strong>${esc(x.nome)}</strong> (${esc(CHANCE_TXT[x.chance])}): ${esc(x.por_que)}</li>`).join('');
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#111827;">
      <h2 style="margin:0 0 4px;font-size:18px;">Clientes para agir hoje (${esc(data)})</h2>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">A Lia leu ${analisadas} conversa(s) dos últimos ${DIAS_MAXIMOS} dias.</p>
      <h3 style="margin:0 0 8px;font-size:16px;">Precisam de você (${voce.length})</h3>
      ${cartoes || '<p style="font-size:14px;">Nenhum cliente esperando por você agora.</p>'}
      <h3 style="margin:18px 0 8px;font-size:16px;">Boa chance, a Lia está cuidando (${lia.length})</h3>
      ${listaLia ? `<ul style="padding-left:18px;font-size:13px;margin:0;">${listaLia}</ul>` : '<p style="font-size:14px;">Nenhum.</p>'}
      <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">Pouca ou nenhuma chance: ${resto.length} conversa(s), não precisa fazer nada.${erros ? ` (${erros} não consegui ler desta vez.)` : ''}</p>
    </div>`;
  const assunto = voce.length ? `Lia: ${voce.length} cliente(s) precisam de você hoje` : 'Lia: nenhum cliente esperando por você hoje';
  return { assunto, html };
}

/** O e-mail do dia já deve sair? (a partir das 8h de Brasília, uma vez por dia) */
export function horaDoResumo(agora, ultimoDia, horaMinima = 8) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(agora));
  return h >= horaMinima && h < 20 && ultimoDia !== diaDeBrasilia(agora);
}
