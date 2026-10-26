/**
 * Proteções de conteúdo: pedido de parada do lead e validação de tudo que o
 * bot pretende enviar. Nada sai para o lead sem passar por `validarSaida`.
 */

import { calcularHonorario, HONORARIO_MINIMO_PF } from './util.js';

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
];

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

/** Valores que o bot pode citar: somente os que o próprio site mostrou ao lead. */
export function valoresPermitidos(lead) {
  const h = calcularHonorario(lead);
  if (h.tipo === 'PJ') return [h.base]; // empresa: nunca valor de economia; só a base do honorário
  const extras = [];
  if (h.economiaConhecida) {
    extras.push(h.valor);
    if (h.minimoAplicado) extras.push(h.doze);
    if (h.liquido > 0) extras.push(h.liquido); // quanto sobra para a pessoa depois dos honorários
  } else {
    extras.push(HONORARIO_MINIMO_PF); // sem economia estimada: pode explicar a regra de R$ 600
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
  if (!ignorarClt && lead?.responsavel !== 'PJ' && REGEX_CLT_PF.test(t)) {
    return {
      ok: false,
      motivo:
        'fala em funcionário registrado/CLT para pessoa física. Para pessoa física a frente é o trabalhador AUTÔNOMO com INSS recolhido ligado ao CNO, inclusive de forma retroativa (mesmo que nada tenha sido recolhido); funcionário registrado é só para empresa. Reescreva sem insinuar que a falta de recolhimento atrapalha',
    };
  }

  const permitidos = [...valoresPermitidos(lead), ...valoresExtras];
  for (const v of extrairValoresReais(t)) {
    const confere = permitidos.some((p) => Math.abs(p - v) <= 1);
    if (!confere) {
      return {
        ok: false,
        motivo: `cita o valor R$ ${v.toLocaleString('pt-BR')}, que não é um número que o site mostrou ao lead (não invente nem calcule valores)`,
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
  return /(honorari|quanto (voce|vc|ele|o gabriel|vcs|voces)?\s*(cobra|cobram|custa|fica|e que|sai)|quanto (e|eh|custa|fica|sai|seria)|\bcusto\b|\bcustos\b|\bcustar\b|\bpreco|valor do (servico|trabalho|honorario)|qual (e )?o valor|cobranca|\bcobra|\bcobram|\bpagar (pra|para) (voce|vc|ele|o gabriel)|percentual|\bporcentagem|comissao|\btaxa\b|mensalidade|\bcaro\b|\bbarato\b|desconto)/.test(t);
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
  return /liga[cç][aã]o hoje|desconto|negocia|condi[cç][aã]o|pessoa|humano|atendente|falar com (o )?gabriel|irrit|reclam|document|[aá]udio|proposta formal|decidid|contrat|fechar|dados do contrato|pediu para falar/i.test(String(motivo ?? ''));
}
