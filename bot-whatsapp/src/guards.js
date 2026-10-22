/**
 * Proteções de conteúdo: pedido de parada do lead e validação de tudo que o
 * bot pretende enviar. Nada sai para o lead sem passar por `validarSaida`.
 */

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
  [/\bjur[ií]dic[oa]s?\b/i, 'palavra "jurídico/jurídica" (use "empresa")'],
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
  if (lead.responsavel === 'PJ') return [];
  return [lead.inss_estimado, lead.economia_estimada, lead.valor_apos_reducao]
    .map((v) => (v === null || v === undefined ? NaN : Number(v)))
    .filter((v) => Number.isFinite(v));
}

/**
 * @returns {{ok: true} | {ok: false, motivo: string}}
 */
export function validarSaida(texto, lead, valoresExtras = []) {
  const t = String(texto ?? '');
  if (!t.trim()) return { ok: false, motivo: 'mensagem vazia' };
  if (t.length > 900) return { ok: false, motivo: 'mensagem longa demais para WhatsApp (resuma)' };

  for (const [regex, nome] of PROIBIDAS) {
    if (regex.test(t)) return { ok: false, motivo: `contém ${nome}, que é proibido` };
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
