#!/usr/bin/env node
/**
 * Atualiza `src/data/selicMensal.ts` com os meses mais recentes da Taxa Selic
 * acumulada no mês (Bacen, SGS série 4390) — a mesma série usada
 * oficialmente para atualização de débitos tributários (Art. 31, IN RFB
 * nº 2021/2021).
 *
 * Roda sozinho, todo mês, pelo GitHub Actions
 * (.github/workflows/update-selic.yml) — não precisa mais editar esse
 * arquivo manualmente nem pedir pra alguém atualizar.
 *
 * Comportamento:
 *   - Busca os últimos meses publicados pelo Bacen.
 *   - Só ACRESCENTA meses que ainda não estão na tabela — nunca sobrescreve
 *     um mês que já existe (a Selic publicada não costuma ser revisada, e
 *     preferimos preservar o que já foi conferido manualmente no passado).
 *   - Se não houver nenhum mês novo, não altera o arquivo (o workflow então
 *     não cria commit nenhum).
 *
 * Pode ser rodado manualmente também: `node scripts/update-selic.mjs`.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARQUIVO = fileURLToPath(new URL('../src/data/selicMensal.ts', import.meta.url));
const API_URL =
  process.env.SELIC_API_URL || 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados/ultimos/6?formato=json';
const MARCADOR_INICIO = 'export const SELIC_MENSAL: Record<string, number> = {';

/** "01/09/2026" -> "2026-09" */
function chaveDoMes(dataBcb) {
  const [, mes, ano] = dataBcb.split('/');
  return `${ano}-${mes}`;
}

async function buscarUltimosMeses() {
  const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Falha ao consultar a API do Bacen: ${response.status} ${await response.text()}`);
  }
  const dados = await response.json();
  return dados
    .map((item) => {
      const valor = Number(item.valor);
      if (!Number.isFinite(valor) || valor < 0 || valor > 10) {
        // Faixa de segurança para a era atual da Selic — se algum dia vier um
        // valor fora disso, é mais provável ser um erro da API do que um
        // valor real, então preferimos parar e avisar a aceitar às cegas.
        throw new Error(`Valor da Selic fora da faixa esperada (0–10%), ignorando por segurança: ${JSON.stringify(item)}`);
      }
      return { chave: chaveDoMes(item.data), valor };
    })
    .filter((item) => /^\d{4}-\d{2}$/.test(item.chave));
}

export function aplicarNovosMeses(conteudoAtual, novosMeses) {
  const inicio = conteudoAtual.indexOf(MARCADOR_INICIO);
  const fim = conteudoAtual.indexOf('\n};', inicio);
  if (inicio === -1 || fim === -1) {
    throw new Error('Não encontrei o objeto SELIC_MENSAL no arquivo — verifique se o formato do arquivo mudou.');
  }

  const corpo = conteudoAtual.slice(inicio + MARCADOR_INICIO.length, fim);
  const linhaRegex = /'(\d{4}-\d{2})':\s*([\d.]+),?/g;
  const chavesExistentes = new Set();
  let maiorChaveExistente = '';
  let match;
  while ((match = linhaRegex.exec(corpo))) {
    chavesExistentes.add(match[1]);
    if (match[1] > maiorChaveExistente) maiorChaveExistente = match[1];
  }

  // Só acrescenta meses realmente novos (não regrava os que já existem —
  // preserva a formatação original de tudo que já estava no arquivo).
  const adicionados = novosMeses
    .filter((item) => !chavesExistentes.has(item.chave))
    .sort((a, b) => (a.chave < b.chave ? -1 : 1));

  if (adicionados.length === 0) {
    return { novoConteudo: conteudoAtual, adicionados: [] };
  }

  // Salvaguarda: a Selic é sempre publicada mês a mês, em ordem — se algum
  // mês "novo" vier mais antigo que o último já registrado, algo está
  // estranho (a tabela não é mais estritamente cronológica) e é mais seguro
  // parar do que inserir fora de ordem silenciosamente.
  const foraDeOrdem = adicionados.find((item) => item.chave <= maiorChaveExistente);
  if (foraDeOrdem) {
    throw new Error(
      `O mês ${foraDeOrdem.chave} viria antes do último mês já registrado (${maiorChaveExistente}) — ` +
        'isso não deveria acontecer com a série da Selic. Adicione manualmente e revise a tabela.'
    );
  }

  const novasLinhas = adicionados.map((item) => `  '${item.chave}': ${item.valor},`).join('\n');
  const novoConteudo = conteudoAtual.slice(0, fim) + '\n' + novasLinhas + conteudoAtual.slice(fim);

  return { novoConteudo, adicionados: adicionados.map((item) => item.chave) };
}

async function main() {
  const conteudoAtual = readFileSync(ARQUIVO, 'utf8');
  const novosMeses = await buscarUltimosMeses();
  const { novoConteudo, adicionados } = aplicarNovosMeses(conteudoAtual, novosMeses);

  if (adicionados.length === 0) {
    console.log('[update-selic] Nenhum mês novo publicado pelo Bacen ainda. Nada a atualizar.');
    return;
  }

  writeFileSync(ARQUIVO, novoConteudo, 'utf8');
  console.log(`[update-selic] Meses adicionados: ${adicionados.join(', ')}`);
}

// Só roda automaticamente quando chamado diretamente (`node update-selic.mjs`),
// não quando importado por um teste.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('[update-selic] Erro:', error.message);
    process.exit(1);
  });
}
