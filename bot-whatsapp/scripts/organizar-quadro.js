/**
 * Reorganiza o quadro do CRM lendo as conversas do WhatsApp (pedido do Gabriel, 23/11/2026).
 *
 *   node scripts/organizar-quadro.js            -> só ANALISA e mostra o que mudaria (não mexe em nada)
 *   node scripts/organizar-quadro.js --aplicar  -> aplica o plano da última análise
 *
 * Regras: nunca coloca card em "Fechado" (só avisa "possível fechado, confira"); cards já em "Fechado" não são tocados;
 * cards já em "Perdido" também não são tocados, nem os que o Gabriel mudou de coluna à mão no CRM (pedidos dele em 27/11/2026);
 * leads sem conversa no WhatsApp ficam como estão. Cada mudança deixa uma nota no card com o motivo.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';
import { MOTIVOS_PERDA, movidoAMao } from '../src/funil.js';

const PLANO = '/root/organizar-quadro-plano.json';
/** Colunas que a organização nunca mexe: o card fica onde o Gabriel deixou. */
const INTOCAVEIS = ['fechado', 'perdido'];
const APLICAR = process.argv.includes('--aplicar');
const db = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });

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

function checar({ data, error }, ctx) {
  if (error) throw new Error(`Supabase (${ctx}): ${error.message}`);
  return data;
}

function carimbo() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date());
}

const quem = (d) => ({ lead: 'CLIENTE', bot: 'LIA (bot)', humano: 'GABRIEL' }[d] || d);
const quando = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

const INSTRUCOES = `Você organiza o quadro de vendas (CRM) do Gabriel Zaneloti, especialista em redução de INSS de obra.
Leia a conversa de WhatsApp e diga em qual coluna o card do cliente deve ficar HOJE. Colunas:
- contatado: a conversa começou, mas ainda não chegou no preço (o cliente respondeu, está tirando dúvidas, recebeu a simulação etc.).
- sem_resposta: o cliente NUNCA respondeu, ou parou de responder antes de receber o preço.
- proposta_enviada: o honorário/preço do serviço já foi apresentado (pela Lia ou pelo Gabriel) e o cliente ainda não deu sinal claro de decisão.
- decidindo: o cliente mostrou interesse real: pediu o contrato ou a lista de dados, mandou documentos, disse que vai pensar, conversar com alguém ou que vai fechar.
- agendado: existe uma consultoria/ligação MARCADA (dia e hora) que ainda não aconteceu.
- perdido: o cliente recusou, achou caro e encerrou, disse que já resolveu, que vai fazer sozinho, pediu para parar, ou ficou mais de 14 dias sem responder depois de receber o preço e de ser lembrado.
- fechado: o contrato foi fechado (aceitou o preço E mandou os dados do contrato, assinou ou pagou).
Use o momento MAIS RECENTE da conversa. Hoje é ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full' }).format(new Date())}.
Responda SÓ com um JSON, sem texto fora dele: {"status": "<coluna>", "motivo_perda": "<preco|vai_fazer_sozinho|desconfianca|ja_resolveu|sem_resposta|sem_interesse|pediu_para_parar|outro, só se perdido>", "motivo": "<uma frase curta em português explicando>"}`;

async function classificar(anthropic, lead, conversa, msgs) {
  const texto = msgs.map((m) => `[${quando(m.criado_em)}] ${quem(m.direcao)}: ${String(m.texto || '').slice(0, 800)}`).join('\n');
  const extra = [
    `Coluna atual: ${ROTULO[lead.status] || lead.status || 'Novo'}`,
    conversa.agendou_em ? `O sistema registrou que este cliente agendou uma consultoria em ${quando(conversa.agendou_em)}.` : '',
    conversa.observacao ? `Observação da conversa: ${conversa.observacao}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const r = await anthropic.messages.create({
    model: config.modelo,
    max_tokens: 300,
    system: INSTRUCOES,
    messages: [{ role: 'user', content: `${extra}\n\nCONVERSA:\n${texto}` }],
  });
  const bruto = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  const json = JSON.parse(bruto.slice(bruto.indexOf('{'), bruto.lastIndexOf('}') + 1));
  if (!(json.status in ROTULO)) throw new Error(`coluna inválida: ${json.status}`);
  return json;
}

async function analisar() {
  const anthropic = new Anthropic({ apiKey: config.anthropicKey });
  const leads = checar(await db.from('leads').select('id,nome,whatsapp,status,notas'), 'leads').filter(
    (l) => !INTOCAVEIS.includes(l.status || 'novo') && !movidoAMao(l)
  );
  const conversas = checar(await db.from('bot_conversas').select('*'), 'conversas');
  const porLead = new Map(conversas.map((c) => [c.lead_id, c]));
  const alvos = leads.filter((l) => porLead.has(l.id));
  console.log(`Lendo ${alvos.length} conversas (de ${leads.length} cards fora de "Fechado", "Perdido" e dos que você moveu à mão)...`);

  const plano = [];
  let i = 0;
  async function trabalhador() {
    while (i < alvos.length) {
      const lead = alvos[i++];
      const conversa = porLead.get(lead.id);
      try {
        const msgs = (
          checar(
            await db.from('bot_mensagens').select('direcao,texto,criado_em').eq('conversa_id', conversa.id).order('criado_em', { ascending: false }).limit(60),
            'mensagens'
          ) || []
        ).reverse();
        if (!msgs.length) continue;
        const r = await classificar(anthropic, lead, conversa, msgs);
        const atual = lead.status || 'novo';
        if (r.status === atual) continue;
        plano.push({ id: lead.id, nome: lead.nome || '(sem nome)', tel: String(lead.whatsapp || '').replace(/\D/g, '').slice(-4), de: atual, para: r.status, motivo_perda: r.motivo_perda || null, motivo: r.motivo || '' });
      } catch (e) {
        console.log(`  (não consegui analisar ${lead.nome || lead.id}: ${e.message})`);
      }
    }
  }
  await Promise.all([1, 2, 3, 4].map(trabalhador));
  writeFileSync(PLANO, JSON.stringify(plano, null, 1));

  if (!plano.length) {
    console.log('Nada a mudar: todos os cards já estão na coluna certa.');
    return;
  }
  const aplicaveis = plano.filter((p) => p.para !== 'fechado');
  console.log(`\nMUDANÇAS SUGERIDAS (${aplicaveis.length}):`);
  for (const p of aplicaveis) console.log(`- ${p.nome} (final ${p.tel}): ${ROTULO[p.de] || p.de} -> ${ROTULO[p.para]}. ${p.motivo}`);
  const fechados = plano.filter((p) => p.para === 'fechado');
  if (fechados.length) {
    console.log(`\nPOSSÍVEIS CONTRATOS FECHADOS (confira e arraste você mesmo; não vou mexer):`);
    for (const p of fechados) console.log(`- ${p.nome} (final ${p.tel}): ${p.motivo}`);
  }
  console.log('\nNada foi alterado ainda.');
}

async function aplicar() {
  if (!existsSync(PLANO)) throw new Error('Não achei a análise. Rode primeiro sem --aplicar.');
  const plano = JSON.parse(readFileSync(PLANO, 'utf8')).filter((p) => p.para !== 'fechado');
  let feitos = 0;
  for (const p of plano) {
    const atual = checar(await db.from('leads').select('status,notas,motivo_perda').eq('id', p.id).maybeSingle(), 'ler lead');
    if (!atual || INTOCAVEIS.includes(atual.status) || movidoAMao(atual) || atual.status !== p.de) continue; // mudou desde a análise: não mexe
    const patch = {
      status: p.para,
      notas: `${atual.notas ? `${atual.notas}\n` : ''}[Organização do quadro ${carimbo()}] ${ROTULO[p.de] || p.de} -> ${ROTULO[p.para]}: ${p.motivo}`,
    };
    if (p.para === 'perdido' && p.motivo_perda && MOTIVOS_PERDA.includes(p.motivo_perda) && 'motivo_perda' in atual && !atual.motivo_perda) patch.motivo_perda = p.motivo_perda;
    checar(await db.from('leads').update(patch).eq('id', p.id), 'atualizar lead');
    feitos++;
  }
  console.log(`Pronto: ${feitos} card(s) mudaram de coluna. Cada um ganhou uma nota explicando o motivo.`);
}

(APLICAR ? aplicar() : analisar()).catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
