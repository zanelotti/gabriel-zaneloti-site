/**
 * Lê a pasta `conhecimento/` (arquivos .md e .txt) e entrega o texto ao assistente.
 * Os valores em reais escritos nesses arquivos passam a poder ser citados pelo bot.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairValoresReais } from './guards.js';

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
  if (!existsSync(pasta)) return { itens: [] };
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
  };
}
