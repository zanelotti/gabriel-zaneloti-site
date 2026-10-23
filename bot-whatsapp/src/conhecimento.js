/**
 * Lê a pasta `conhecimento/` (arquivos .md e .txt) e entrega o texto ao assistente.
 * Os valores em reais escritos nesses arquivos passam a poder ser citados pelo bot.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { extrairValoresReais } from './guards.js';

/** SHA-256 de versões antigas de arquivos que foram corrigidas. Se o texto no CRM ainda for IDÊNTICO a uma delas (ninguém editou), é trocado pelo novo automaticamente. */
const VERSOES_ANTERIORES = {
  '04-formas-de-reduzir.md': ['b0bd0a3827bd0556bc1d0b80307834dd21b3914e18bebe8531bec1801136ec08'],
  '06-casos-de-sucesso.md': ['c54d9bc3a5435467b0c492ee603a7d3250299f0cbddcd420e84279ca1cf6e4f4'],
};
export const sha256 = (t) => createHash('sha256').update(String(t ?? '').trim()).digest('hex');

const PASTA_PADRAO = fileURLToPath(new URL('../conhecimento', import.meta.url));

export function carregarConhecimento(pasta = PASTA_PADRAO) {
  if (!existsSync(pasta)) return { texto: '', valores: [], arquivos: [] };
  const arquivos = readdirSync(pasta)
    .filter((f) => /\.(md|txt)$/i.test(f) && !f.startsWith('_'))
    .sort();
  const texto = arquivos.map((f) => `## Arquivo: ${f}\n${readFileSync(join(pasta, f), 'utf8').trim()}`).join('\n\n');
  return { texto, valores: extrairValoresReais(texto), arquivos };
}

/** Arquivos da pasta no formato da tabela bot_conhecimento (para copiar para o banco na primeira vez). */
export function arquivosParaSemear(pasta = PASTA_PADRAO) {
  if (!existsSync(pasta)) return { itens: [], versoes: {} };
  const arquivos = readdirSync(pasta)
    .filter((f) => /\.(md|txt)$/i.test(f) && !f.startsWith('_'))
    .sort();
  return {
    itens: arquivos.map((f, i) => ({
      chave: f,
      titulo: f.replace(/\.(md|txt)$/i, '').replace(/^\d+-/, '').replace(/[-_]/g, ' '),
      conteudo: readFileSync(join(pasta, f), 'utf8').trim(),
      ordem: (i + 1) * 10,
    })),
    versoes: VERSOES_ANTERIORES,
  };
}
