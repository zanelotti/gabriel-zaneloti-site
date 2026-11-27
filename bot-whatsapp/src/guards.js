/**
 * Proteções de conteúdo: pedido de parada do lead e validação de tudo que o
 * bot pretende enviar. Nada sai para o lead sem passar por `validarSaida`.
 */

import { calcularHonorario, HONORARIO_BASE_PJ, HONORARIO_MINIMO_PF, obraEmAndamento } from './util.js';
import { semSimulacao } from './origem.js';

/** O lead pediu para não receber mais mensagens? */
export function pediuParar(texto) {
  const t = String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (!t) return false;
  if (/^(pare|parar|stop|sair|cancelar|descadastrar|remover)[.!\s]*$/.test(t)) return true;
  return /(nao quero (mais )?(receber|contato|mensagem|mensagens|conversar|ser contactad)|nao (me )?(chame|chama|mande|manda|envie|envia|ligue|liga) mais|pare de (me )?(mandar|enviar|chamar)|me (tire|tira|remova|remove|exclua|exclui) (da lista|dessa lista)|descadastr|para de me (mandar|enviar|chamar))/.test(
    t
  );
}

// Palavras e promessas que o Gabriel NÃO quer em texto enviado a lead.
const PROIBIDAS = [
  // O Gabriel é SEMPRE "Gabriel" (pedido dele, 26/11). Nunca só o sobrenome. "Gabriel Zaneloti" junto pode.
  [/(?<!gabriel\s{1,3})\bzan+el+ot+i\b/i, 'o sobrenome "Zaneloti" sozinho (chame-o sempre de "Gabriel"; para não repetir o nome, use "ele" ou "nós")'],
  [/mensagem do gabriel:/i, 'a marca interna "(Mensagem do Gabriel:)" (ela é só do histórico; escreva só a sua resposta)'],
  [/\b(legal|legais|legalmente|ilegal|ilegais)\b/i, 'palavra "legal"'],
  // "pessoa jurídica" é o termo correto para empresa e pode; o que fica proibido é "jurídico/jurídica" em outro sentido (assessoria jurídica etc.).
  [/(?<!pessoas?\s)\bjur[ií]dic[oa]s?\b/i, 'palavra "jurídico/jurídica" fora de "pessoa jurídica"'],
  [/\bdireitos?\b/i, 'palavra "direito"'],
  [/\badvogad[oa]s?\b/i, 'palavra "advogado"'],
  [/s[oó]\s+paga/i, 'frase "só paga se economizar"'],
  [/risco\s+zero/i, '"risco zero"'],
  [/sem\s+risco/i, '"sem risco"'],
  [/\bm[ií]nimo\b/i, 'menção a valor mínimo'],
  [/\b15\s?%/i, 'percentual de 15% (o honorário é 12%)'],
  [/\b(garanto|garantimos|garantido|garantida|garantia de)\b/i, 'promessa/garantia de resultado'],
  [/\b(com certeza voc[eê] vai economizar|certeza de economia)\b/i, 'certeza de economia'],
  // Os valores da simulação estão corretos: nada de ressalva do tipo "é uma estimativa", "só se confirma na análise", "o Gabriel vai confirmar".
  [/\bestimativas?\b|\b(?:inss|economia|valor|valores|redu[cç][aã]o|honor[aá]rio)\s+estimad[oa]s?\b|\b(?:valor|valores|n[uú]meros?|economia|c[aá]lculo|resultado)[^.!?\n]{0,25}\baproximad|\bpode(?:m)?\s+variar\b|\bse\s+confirma\b|\bconfirmad[oa]s?\s+(?:na|com|pela|depois|ap[oó]s)\b|\bconfirm\w*[^.!?\n]{0,40}\b(?:an[aá]lise|documentos)\b|\b(?:valor|resultado)\s+(?:final|real)\b|\bgabriel\s+(?:vai\s+|ainda\s+|precisa\s+|tem\s+que\s+|depois\s+)*(?:confirm|valid)\w*|\bgabriel\s+(?:vai|precisa|tem\s+que)\s+(?:fazer\s+(?:uma\s+)?)?an[aá]lis\w*/i, 'ressalva de que o valor é estimativa ou que o Gabriel ainda vai confirmar/analisar (os valores estão corretos: apresente sem ressalva)'],
  // A conta líquida é implícita: nunca diga quanto "sobra" ou "fica com a pessoa" depois do honorário.
  [/\b(?:fic|sobr)[a-zçãõáéíóúâêô]*[^.!?\n]{0,40}R\$[^.!?\n]{0,30}\b(?:com voc[eê]|para voc[eê]|no (?:seu )?bolso|l[ií]quid)/i, 'valor líquido que sobra para a pessoa (a conta líquida é implícita; não diga isso)'],
  [/R\$\s*[\d.,]+[^.!?\n]{0,30}\b(?:fic|sobr)[a-zçãõáéíóúâêô]*[^.!?\n]{0,25}\b(?:com voc[eê]|para voc[eê]|no (?:seu )?bolso)/i, 'valor líquido que sobra para a pessoa (a conta líquida é implícita; não diga isso)'],
  [/\bno (?:seu )?bolso\b|\bvalor l[ií]quido\b|\bl[ií]quido (?:para|de) voc[eê]\b/i, 'conta líquida (a conta líquida é implícita; não diga isso)'],
  // Fechamento tem de ser pergunta objetiva (sim/não), nunca pergunta aberta.
  [/\b(como|de que (?:forma|maneira)|qual (?:o |seu )?(?:melhor )?caminho)\b[^.!?\n]{0,25}\b(voc[eê]|vc|prefere|gostaria|quer|deseja)\b[^.!?\n]{0,20}\b(seguir|prosseguir|avan[cç]ar|continuar|prefere)\b/i, 'pergunta aberta de fechamento (como você gostaria de seguir?); use a pergunta objetiva de sim ou não'],
];

/** Parcelamento do saldo/INSS da obra (não pega o parcelamento do honorário no cartão). */
export const REGEX_PARCELA_SALDO =
  /parcel\w*[^.?!\n]{0,70}\b(saldo|inss|d[ée]bito|d[ií]vida)\b|\b(saldo|inss|d[ée]bito|d[ií]vida)\b[^.?!\n]{0,70}parcel\w*|\b60\s*(vezes|parcelas|x)\b/i;

export const REGEX_CLT_PF = /funcion[aá]rios?\s+(registrad|com\s+carteira|contratad)|registrad[oa]s?\s+(em\s+)?(clt|na\s+carteira)|\bclt\b|carteira\s+assinada/i;

/** Valores em R$ citados no texto, como números. */
export function extrairValoresReais(texto) {
  const valores = [];
  const re = /R\$\s*([\d]{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n)) valores.push(n);
  }
  return valores;
}

/** Valores que o bot pode citar: somente os dos dados do lead (calculados pelo sistema). */
export function valoresPermitidos(lead) {
  // Contato pelo botão de WhatsApp ou e-book (sem simulação): não há números de cálculo; só o honorário de pessoa física (R$ 800 mínimo) e de empresa (R$ 1.000).
  if (semSimulacao(lead)) return [HONORARIO_MINIMO_PF, HONORARIO_BASE_PJ];
  const h = calcularHonorario(lead);
  if (h.tipo === 'PJ') return [h.base]; // empresa: nunca valor de economia; só a base do honorário
  const extras = [];
  if (h.economiaConhecida) {
    extras.push(h.valor);
    if (h.minimoAplicado) extras.push(h.doze);
  } else {
    extras.push(HONORARIO_MINIMO_PF); // sem economia estimada: pode explicar a regra do valor mínimo (R$ 800)
  }
  return [lead.inss_estimado, lead.economia_estimada, lead.valor_apos_reducao, ...extras]
    .map((v) => (v === null || v === undefined ? NaN : Number(v)))
    .filter((v) => Number.isFinite(v));
}

/** A palavra "mínimo" (valor mínimo de honorário) só pode aparecer quando a regra de piso se aplica ao lead. */
function podeFalarMinimo(lead) {
  const h = calcularHonorario(lead);
  return h.tipo === 'PJ' || h.minimoAplicado === true || h.economiaConhecida === false;
}

/**
 * @returns {{ok: true} | {ok: false, motivo: string}}
 */
export function validarSaida(texto, lead, valoresExtras = [], { ignorarClt = false } = {}) {
  const t = String(texto ?? '');
  if (!t.trim()) return { ok: false, motivo: 'mensagem vazia' };
  if (t.length > 1200) return { ok: false, motivo: 'mensagem longa demais para WhatsApp (resuma)' };

  const liberaMinimo = podeFalarMinimo(lead || {});
  for (const [regex, nome] of PROIBIDAS) {
    if (liberaMinimo && nome === 'menção a valor mínimo') continue;
    if (regex.test(t)) return { ok: false, motivo: `contém ${nome}, que é proibido` };
  }

  // Pessoa física: a frente de mão de obra é o autônomo com recolhimento (inclusive retroativo); CLT/funcionário registrado é de empresa.
  if (!ignorarClt && lead?.responsavel !== 'PJ' && !semSimulacao(lead) && REGEX_CLT_PF.test(t)) {
    return {
      ok: false,
      motivo:
        'fala em funcionário registrado/CLT para pessoa física. Para pessoa física a frente é o trabalhador AUTÔNOMO com INSS recolhido ligado ao CNO, inclusive de forma retroativa (mesmo que nada tenha sido recolhido); funcionário registrado é só para empresa. Reescreva sem insinuar que a falta de recolhimento atrapalha',
    };
  }

  // Obra em andamento NÃO parcela o INSS (é pago mês a mês, conforme a obra avança). O parcelamento em até 6x do HONORÁRIO no cartão é outro assunto e continua liberado.
  if (obraEmAndamento(lead) && REGEX_PARCELA_SALDO.test(t)) {
    return {
      ok: false,
      motivo:
        'fala em parcelar o saldo/INSS da obra, mas esta obra está EM ANDAMENTO e obra em andamento não parcela: o INSS é pago mês a mês, conforme a obra avança (o parcelamento só vale para meses já em atraso). Reescreva sem falar em parcelamento do INSS.',
    };
  }

  const permitidos = [...valoresPermitidos(lead), ...valoresExtras];
  for (const v of extrairValoresReais(t)) {
    const confere = permitidos.some((p) => Math.abs(p - v) <= 1);
    if (!confere) {
      return {
        ok: false,
        motivo: `cita o valor R$ ${v.toLocaleString('pt-BR')}, que não está nos dados do lead (não invente nem calcule valores)`,
      };
    }
  }
  return { ok: true };
}

export const LIMITE_SUCINTO = 600;

/**
 * Resposta comprida demais para WhatsApp (o lead perde a paciência). Não vale para mensagem pronta do
 * conhecimento (lista com negrito de WhatsApp ou 3+ linhas seguidas), que é enviada como está.
 */
export function muitoLonga(texto, limite = LIMITE_SUCINTO) {
  const t = String(texto ?? '').trim();
  const linhas = t.split('\n').filter((l) => l.trim()).length;
  const umBlocoSo = !/\n\s*\n/.test(t);
  if (/\*[^*\n]+\*/.test(t) || (umBlocoSo && linhas >= 4)) return false;
  return t.replace(/\s+/g, ' ').length > limite;
}

/** Divide a resposta do modelo em até 3 mensagens curtas (parágrafos separados por linha em branco). */
export function dividirMensagens(texto, max = 3) {
  const partes = String(texto ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length <= max) return partes;
  const cabeca = partes.slice(0, max - 1);
  cabeca.push(partes.slice(max - 1).join('\n\n'));
  return cabeca;
}

/** O lead perguntou (ou puxou o assunto de) custo/honorário? */
export function leadPerguntouPreco(texto) {
  const t = String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /(honorari|quanto (voce|vc|ele|o gabriel|vcs|voces)?\s*(cobra|cobram|custa|fica|e que|sai)|quanto (e|eh|custa|fica|sai|seria)|\bquando (custa|cobra|fica|sai|e o (servico|honorario|investimento))|\bquanto\b[^?.!\n]{0,30}\b(servico|trabalho|honorario|investimento)|\bcusto\b|\bcustos\b|\bcustar\b|\bpreco|valor do (servico|trabalho|honorario)|qual (e )?o valor|cobranca|\bcobra|\bcobram|\bpagar (pra|para) (voce|vc|ele|o gabriel)|percentual|\bporcentagem|comissao|\btaxa\b|mensalidade|\bcaro\b|\bbarato\b|desconto|\binvestimento\b)/.test(t);
}

/**
 * O bot ofereceu mostrar o investimento ("posso te mostrar o investimento?") e o lead aceitou na mensagem seguinte?
 * Só então o honorário pode sair sem o lead ter perguntado o preço.
 */
export function aceitouVerInvestimento(historico) {
  const h = Array.isArray(historico) ? historico : [];
  let i = h.length - 1;
  const respostas = [];
  while (i >= 0 && h[i].direcao === 'lead') respostas.unshift(h[i--].texto || '');
  const oferta = i >= 0 ? String(h[i].texto || '') : '';
  if (!respostas.length || !/investimento/i.test(oferta)) return false;
  const r = respostas
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // Pediu para ver ("Mostrar o investimento", "pode mostrar", "qual o valor?"): vale mesmo com "não" junto ("não, pode mostrar").
  // Antes "mostrar" (infinitivo) não contava e a Lia explicou tudo de novo e repetiu o convite (bug de 27/11/2026).
  const pediuVer = /\b(mostr\w*|ver|veja|investimento|valor|valores|preco|quanto|honorari\w*|manda ver)\b/.test(r);
  if (/\b(agora nao|depois|mais tarde|nao quero|ainda nao|outra hora|vou ver|ver com|vou pensar|pensar|falar com)\b/.test(r)) return false;
  if (pediuVer) return true;
  if (/\bnao\b/.test(r)) return false;
  return /\b(sim|s|pode|podes|quero|manda|mande|envia|envie|claro|ok|okay|bora|vamos|beleza|blz|show|isso|por favor|pfv|pode ser|gostaria|fala|diz|diga|segue|perfeito|certo|com certeza|aham|uhum)\b/.test(r) || /^\s*(👍|👌|✅|🙏)/u.test(respostas.join(' '));
}

/**
 * Tira das mensagens as perguntas que a Lia (ou o Gabriel) JÁ fez antes na conversa (pedido do Gabriel, 27/11/2026:
 * "nunca repetir a mesma pergunta"). Mensagem que fica vazia sai; a lista de dados do contrato nunca é mexida.
 * Se TUDO for pergunta repetida, devolve [] (quem chama decide o que fazer).
 */
export function tirarPerguntasRepetidas(mensagens, historico = []) {
  const feitas = [];
  for (const m of historico) {
    if (m.direcao === 'lead') continue;
    for (const f of frasesDe(m.texto)) if (f.endsWith('?')) feitas.push(f);
  }
  if (!feitas.length) return mensagens;
  const repetida = (f) => feitas.some((p) => semAcento(p).replace(/[^a-z0-9]/g, '') === semAcento(f).replace(/[^a-z0-9]/g, '') || parecidas(p, f));
  const saida = [];
  for (const msg of mensagens) {
    if (jaTemListaDeDados(msg)) {
      saida.push(msg);
      continue;
    }
    const linhas = String(msg)
      .split('\n')
      .map((linha) => frasesDe(linha).filter((f) => !(f.endsWith('?') && repetida(f))).join(' '))
      .filter((l) => l.trim());
    if (linhas.length) saida.push(linhas.join('\n'));
  }
  return saida;
}

/**
 * Em algum momento da conversa a pessoa pediu o investimento (aceitou o convite ou perguntou o preço)?
 * Vale mesmo que ela tenha feito outra pergunta depois ("Mostrar o investimento" e, em seguida, "Como funciona a assessoria?"):
 * enquanto o honorário não for dito, a Lia deve mostrá-lo (caso da Sangela, 27/11/2026).
 */
export function pediuInvestimentoNaConversa(historico = []) {
  const h = Array.isArray(historico) ? historico : [];
  for (let i = 0; i < h.length; i++) {
    if (h[i].direcao !== 'lead') continue;
    if (i + 1 < h.length && h[i + 1].direcao === 'lead') continue; // olha o bloco de respostas inteiro de uma vez
    const ate = h.slice(0, i + 1);
    if (aceitouVerInvestimento(ate)) return true;
    if (leadPerguntouPreco(h[i].texto)) return true;
  }
  return false;
}

/** A conversa já teve o convite "posso te mostrar o investimento?". */
export function jaConvidouInvestimento(historico = []) {
  return historico.some((m) => m.direcao !== 'lead' && /mostrar o investimento/i.test(String(m.texto || '')));
}

/**
 * O bot ofereceu a lista de dados do contrato ("Posso te passar a lista de dados...?") e o lead aceitou na resposta seguinte?
 * Nesse caso a lista sai na hora, direto pelo código (sem depender do modelo). Se o "sim" vier com uma pergunta junto,
 * devolve false e o modelo responde (o prompt manda enviar a lista também).
 */
export function aceitouListaDeDados(historico) {
  const h = Array.isArray(historico) ? historico : [];
  let i = h.length - 1;
  const respostas = [];
  while (i >= 0 && h[i].direcao === 'lead') respostas.unshift(h[i--].texto || '');
  const oferta = i >= 0 ? String(h[i].texto || '') : '';
  if (!respostas.length || !/lista de dados|dados (do|para o) (seu )?contrato/i.test(oferta) || !/\?/.test(oferta)) return false;
  if (jaTemListaDeDados(oferta)) return false;
  const bruto = respostas.join(' ');
  if (/\?/.test(bruto)) return false;
  const r = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (/\b(nao|depois|ainda|espera|aguarda|calma|amanha|semana|pensar|ver com|falar com)\b/.test(r)) return false;
  return /\b(sim|pode|podes|quero|manda|mande|envia|envie|passa|passe|claro|ok|okay|bora|vamos|beleza|blz|show|isso|por favor|pfv|pf|pode ser|perfeito|certo|com certeza|aham|uhum|s)\b/.test(r) || /^\s*(👍|👌|✅|🙏)/u.test(bruto);
}

/** O texto já traz a lista de dados do contrato (itens com "•" de CPF/CNPJ)? */
export function jaTemListaDeDados(texto) {
  return /•\s*(CPF|CNPJ|Nome completo|Raz[aã]o social)/i.test(String(texto ?? ''));
}

/**
 * A resposta fala em "mandar os dados" (para o contrato) mas não traz a lista? Foi o que aconteceu com a Ester em 27/11/2026:
 * ela aceitou e a Lia respondeu só "Assim que você mandar os dados, encaminho para o Gabriel", sem a lista.
 */
export function prometeDadosSemLista(texto, historico = []) {
  const t = String(texto ?? '');
  if (jaTemListaDeDados(t)) return false;
  // Só frases que PEDEM os dados ("assim que você mandar os dados", "me envie os dados"), não "recebi os dados".
  if (!/assim que (voc[eê] )?(me )?(mandar|enviar|passar)|(me |pode )?(mande|envie|manda|envia|passa|passe)( pra mim| para mim| por aqui)? (os|seus) dados/i.test(t)) return false;
  const doBot = (Array.isArray(historico) ? historico : []).filter((m) => m.direcao !== 'lead');
  return !doBot.some((m) => jaTemListaDeDados(m.texto));
}

/** Pessoa física com economia estimada: tem números (INSS, redução, valor final) para o bot explicar antes de falar do honorário. */
export function precisaExplicarNumeros(lead) {
  const h = calcularHonorario(lead);
  return h.tipo === 'PF' && h.economiaConhecida === true && Number(lead?.economia_estimada) > 0;
}

/** O texto cita algum dos números do cálculo do lead (INSS estimado, economia ou valor após a redução)? */
export function citouNumerosDoCalculo(texto, lead) {
  const alvo = [lead?.inss_estimado, lead?.economia_estimada, lead?.valor_apos_reducao]
    .map((v) => (v === null || v === undefined || v === '' ? NaN : Number(v)))
    .filter((v) => Number.isFinite(v) && v > 0);
  return extrairValoresReais(texto).some((v) => alvo.some((a) => Math.abs(a - v) <= 1));
}

/** O texto do bot fala do honorário do Gabriel (valor, percentual ou "a conta com o honorário")? */
export function falaDeHonorario(texto) {
  return /honor[aá]rio|\b12\s?%|\bdo gabriel cobrar|\bcobran[cç]a\b/i.test(String(texto ?? ''));
}

/**
 * Passar a conversa para o Gabriel logo nas primeiras respostas só se justifica por motivo explícito
 * (pediu pessoa, desconto, irritação, documentos, pronta para contratar, ligação aceita). Dúvida geral
 * ("como funciona?") se responde na conversa.
 */
export function passagemJustificada(motivo) {
  return /corre[cç][aã]o de dados|liga[cç][aã]o hoje|desconto|negocia|condi[cç][aã]o|pessoa|humano|atendente|falar com (o )?gabriel|irrit|reclam|document|[aá]udio|proposta formal|decidid|contrat|fechar|dados do contrato|pediu para falar/i.test(String(motivo ?? ''));
}

// ---------------------------------------------------------------------------
// Repetição: nome da pessoa, nome do Gabriel, abertura igual e perguntas de enchimento
// ---------------------------------------------------------------------------

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const palavras = (t) => semAcento(t).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
const contem = (texto, nome) => new RegExp(`(^|[^a-z0-9])${semAcento(nome).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(semAcento(texto));
const ocorrencias = (texto, nome) => (semAcento(texto).match(new RegExp(`(^|[^a-z0-9])${semAcento(nome)}([^a-z0-9]|$)`, 'g')) || []).length;

// Perguntas "de enchimento": não levam a conversa a lugar nenhum e cansam o lead.
const PERGUNTAS_DE_ENCHIMENTO = [
  /isso combina com/i,
  /faz sentido (pra|para) voc[êe]/i,
  /o que (fez|te fez|levou) voc[êe] (a )?(querer|decidir|buscar|procurar)/i,
  /o que te (levou|fez) a/i,
  /(ficou|est[áa]) (tudo )?claro\??\s*$/i,
  /tudo bem at[ée] aqui/i,
  /(voc[êe] )?concorda\??\s*$/i,
];

function frasesDe(texto) {
  return String(texto ?? '').split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
}

function ultimaPergunta(texto) {
  const frases = String(texto ?? '').split(/(?<=[.!?])\s+|\n+/).map((f) => f.trim()).filter(Boolean);
  for (let i = frases.length - 1; i >= 0; i--) if (frases[i].endsWith('?')) return frases[i];
  return '';
}

function parecidas(a, b) {
  const A = new Set(palavras(a));
  const B = new Set(palavras(b));
  if (A.size < 3 || B.size < 3) return false;
  let comum = 0;
  for (const w of A) if (B.has(w)) comum += 1;
  return comum / (A.size + B.size - comum) >= 0.55;
}

/**
 * A resposta repete demais? Devolve o motivo (texto para o aviso interno ao modelo) ou null se está ok.
 *  - nome da pessoa: só se não apareceu nas últimas 3 mensagens do bot (e no máximo 1 vez na resposta);
 *  - "Gabriel": no máximo 2 vezes nas últimas 3 mensagens somadas à resposta, e 1 vez por resposta;
 *  - abertura igual à de uma das últimas mensagens ("Isso ajuda, ...", "Tranquilo, ...");
 *  - pergunta de enchimento ou quase igual a uma pergunta já feita.
 * `historico` = mensagens da conversa (direcao 'lead' = pessoa; as demais são do bot ou do Gabriel).
 */
export function repeticaoExcessiva(texto, historico = [], nomes = []) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  const doBot = historico.filter((m) => m.direcao !== 'lead').map((m) => String(m.texto || ''));
  const ultimas = doBot.slice(-3);
  const motivos = [];

  for (const nome of [...new Set(nomes.filter(Boolean))]) {
    if (!contem(t, nome)) continue;
    if (ocorrencias(t, nome) > 1) motivos.push(`usa o nome "${nome}" mais de uma vez na mesma resposta`);
    else if (ultimas.some((m) => contem(m, nome))) motivos.push(`usa o nome "${nome}" de novo, e ele já apareceu nas últimas mensagens (use o nome só de vez em quando, a cada 4 mensagens ou mais; fale direto, sem chamar pelo nome)`);
  }

  if (contem(t, 'gabriel')) {
    const recentes = ultimas.filter((m) => contem(m, 'gabriel')).length;
    if (ocorrencias(t, 'gabriel') > 1) motivos.push('cita "o Gabriel" mais de uma vez na mesma resposta (use "ele" ou reescreva sem o nome; NUNCA troque por "Zaneloti")');
    else if (recentes >= 2) motivos.push('cita "o Gabriel" de novo, e o nome dele já aparece em quase todas as últimas mensagens (diga "ele", "nós", ou só a ação, sem repetir o nome; NUNCA troque por "Zaneloti")');
  }

  const inicio = palavras(t).slice(0, 2).join(' ');
  if (inicio.split(' ').length === 2 && ultimas.some((m) => palavras(m).slice(0, 2).join(' ') === inicio)) {
    motivos.push(`começa com as mesmas palavras de uma mensagem recente ("${t.split(/\s+/).slice(0, 2).join(' ')}...": vá direto ao ponto, sem aquele reconhecimento de abertura)`);
  }

  const pergunta = ultimaPergunta(t);
  if (pergunta) {
    if (PERGUNTAS_DE_ENCHIMENTO.some((r) => r.test(pergunta))) {
      motivos.push(`faz uma pergunta de enchimento ("${pergunta.slice(0, 80)}"): pergunte só o que muda o próximo passo ou, se já entendeu a obra, proponha a conversa rápida com o Gabriel`);
    } else if (doBot.slice(-6).some((m) => parecidas(ultimaPergunta(m), pergunta))) {
      motivos.push(`repete uma pergunta que já foi feita ("${pergunta.slice(0, 80)}")`);
    }
  }

  return motivos.length ? motivos.join('; ') : null;
}
