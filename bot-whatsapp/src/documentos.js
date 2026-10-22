/**
 * Documentos grandes (normativa, manual do SERO etc.).
 *
 * Coloque PDFs, arquivos Word (.docx) ou de texto (.txt/.md) na pasta `documentos/`.
 * Ao ligar, o bot lê tudo, divide em trechos e guarda um índice. A cada pergunta
 * do lead, ele procura os trechos mais relacionados e entrega só esses ao
 * assistente (não o documento inteiro), então funciona mesmo com centenas de páginas.
 *
 * O índice fica em `cache/` e só é refeito para arquivos novos ou alterados.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairValoresReais } from './guards.js';

const require = createRequire(import.meta.url);
const PASTA_DOCUMENTOS = fileURLToPath(new URL('../documentos', import.meta.url));
const PASTA_CACHE = fileURLToPath(new URL('../cache', import.meta.url));
const SUPORTADOS = ['.pdf', '.docx', '.txt', '.md'];
const TAMANHO_TRECHO = 1100;

const STOPWORDS = new Set(
  'para com que uma por mais como mas dos das nos nas ele ela eles elas isso essa esse esta este aqui ali muito tem ter vai vou foi ser sao era seu sua seus suas meu minha nao sim ja tambem entre sobre ate quando onde qual quais pelo pela pelos pelas numa num ao aos'.split(' ')
);

export function tokenizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t))
    .map((t) => (t.length > 6 ? t.slice(0, 6) : t)); // radical: reduzir/reduzido/reduzindo → reduzi
}

/** Divide um texto longo em trechos de ~1100 caracteres, quebrando em fim de linha. */
export function dividirEmTrechos(texto, tamanho = TAMANHO_TRECHO) {
  const linhas = String(texto ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
  const trechos = [];
  let atual = [];
  let len = 0;
  for (const linha of linhas) {
    atual.push(linha);
    len += linha.length + 1;
    if (len >= tamanho) {
      trechos.push(atual.join('\n'));
      atual = [linha]; // 1 linha de sobreposição entre trechos
      len = linha.length + 1;
    }
  }
  if (atual.length > 1 || (atual.length === 1 && trechos.length === 0)) trechos.push(atual.join('\n'));
  return trechos.filter((t) => t.length > 40);
}

async function extrairTexto(caminho) {
  const ext = extname(caminho).toLowerCase();
  if (ext === '.txt' || ext === '.md') return readFileSync(caminho, 'utf8');
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const r = await pdfParse(readFileSync(caminho));
    return r.text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const r = await mammoth.extractRawText({ path: caminho });
    return r.value;
  }
  return '';
}

export function criarIndice(chunks) {
  const docs = chunks.map((c) => {
    const tf = new Map();
    for (const t of tokenizar(c.texto)) tf.set(t, (tf.get(t) || 0) + 1);
    return { ...c, tf };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;

  function buscar(consulta, { k = 4 } = {}) {
    const termos = [...new Set(tokenizar(consulta))];
    if (!termos.length || !N) return [];
    const pontuados = docs
      .map((d) => {
        let score = 0;
        let casados = 0;
        for (const t of termos) {
          const f = d.tf.get(t);
          if (!f) continue;
          casados += 1;
          const idf = Math.log(1 + (N - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));
          score += idf * (f / (f + 1.5));
        }
        return { arquivo: d.arquivo, texto: d.texto, score, casados };
      })
      .filter((p) => p.casados >= Math.min(2, termos.length) && p.score > 0)
      .sort((a, b) => b.score - a.score);
    if (!pontuados.length) return [];
    const corte = pontuados[0].score * 0.45;
    return pontuados.filter((p) => p.score >= corte).slice(0, k);
  }

  return { buscar, total: N };
}

/** Lê a pasta, usa o cache quando possível e devolve { buscar, arquivos, total }. */
export async function indexarDocumentos({ pasta = PASTA_DOCUMENTOS, pastaCache = PASTA_CACHE, log = console } = {}) {
  if (!existsSync(pasta)) return { buscar: () => [], arquivos: [], total: 0 };
  const arquivos = readdirSync(pasta).filter((f) => SUPORTADOS.includes(extname(f).toLowerCase()) && !f.startsWith('_') && !f.startsWith('~'));

  mkdirSync(pastaCache, { recursive: true });
  const arquivoCache = join(pastaCache, 'documentos.json');
  let cache = {};
  try {
    cache = JSON.parse(readFileSync(arquivoCache, 'utf8'));
  } catch {
    cache = {};
  }

  const novoCache = {};
  const chunks = [];
  for (const nome of arquivos) {
    const caminho = join(pasta, nome);
    const st = statSync(caminho);
    const anterior = cache[nome];
    let trechos;
    if (anterior && anterior.mtimeMs === st.mtimeMs && anterior.size === st.size) {
      trechos = anterior.trechos;
    } else {
      log.info(`[documentos] lendo ${nome} (pode levar um pouco)...`);
      try {
        trechos = dividirEmTrechos(await extrairTexto(caminho));
      } catch (e) {
        log.error(`[documentos] não consegui ler ${nome}: ${e.message}`);
        continue;
      }
      if (!trechos.length) log.warn(`[documentos] ${nome} não tem texto legível (PDF escaneado como imagem?). Converta para texto antes.`);
    }
    novoCache[nome] = { mtimeMs: st.mtimeMs, size: st.size, trechos };
    for (const texto of trechos) chunks.push({ arquivo: nome, texto });
  }
  try {
    writeFileSync(arquivoCache, JSON.stringify(novoCache));
  } catch (e) {
    log.warn(`[documentos] não consegui gravar o cache: ${e.message}`);
  }

  const indice = criarIndice(chunks);
  return { ...indice, arquivos: Object.keys(novoCache) };
}

/** Texto dos trechos para o prompt + os valores em R$ citados neles (que o bot pode repetir). */
export function formatarTrechos(trechos) {
  if (!trechos.length) return { texto: '', valores: [] };
  const texto = trechos.map((t, i) => `[Trecho ${i + 1} — ${t.arquivo}]\n${t.texto}`).join('\n\n');
  return { texto, valores: extrairValoresReais(texto) };
}
