/**
 * Transcrição dos áudios que o lead manda no WhatsApp.
 *
 * Roda no próprio servidor da Lia (Whisper "turbo", da OpenAI, em código aberto, pela biblioteca sherpa-onnx):
 * não precisa de chave, não tem custo por áudio e o áudio do cliente não sai do servidor.
 *
 * Na primeira vez a Lia baixa o modelo (uns 560 MB, do GitHub) para a pasta `modelos/` (~1 GB no disco).
 * Enquanto transcreve usa ~1,7 GB de memória; depois de 10 minutos sem áudio, solta essa memória. Enquanto o modelo não estiver pronto, ou se algo der errado, a transcrição devolve
 * null e a Lia faz como antes (avisa o Gabriel que chegou um áudio).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PASTA_BOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_MODELO = path.join(PASTA_BOT, 'modelos', 'whisper-turbo');
const URL_MODELO = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-turbo.tar.bz2';
const ARQUIVOS = { encoder: 'turbo-encoder.int8.onnx', decoder: 'turbo-decoder.int8.onnx', tokens: 'turbo-tokens.txt' };

export const LIMITE_AUDIO = 16 * 1024 * 1024; // ~ 1 hora de áudio do WhatsApp
const MAX_SEGUNDOS = 10 * 60; // áudio mais longo que 10 min: transcreve só os 10 primeiros minutos
const TRECHO_SEGUNDOS = 28; // o Whisper entende até 30 s por vez; áudio maior é dividido em trechos

const modeloPronto = () => Object.values(ARQUIVOS).every((a) => fs.existsSync(path.join(PASTA_MODELO, a)));

let baixando = null;
/** Baixa o modelo uma vez (em segundo plano). Devolve true quando está pronto. */
export function prepararModelo(log = console) {
  if (modeloPronto()) return Promise.resolve(true);
  if (baixando) return baixando;
  baixando = new Promise((resolve) => {
    const pastaTmp = path.join(PASTA_BOT, 'modelos', `.baixando-${Date.now()}`);
    fs.mkdirSync(pastaTmp, { recursive: true });
    log.info('[audio] baixando o modelo de transcrição (uma vez só, leva uns minutos)...');
    const p = spawn('bash', ['-c', `command -v bzip2 >/dev/null || apt-get install -y -qq bzip2 >/dev/null 2>&1; curl -fsSL --retry 3 "${URL_MODELO}" | tar xjf - -C "${pastaTmp}" --strip-components=1`], { stdio: ['ignore', 'ignore', 'pipe'] });
    let erro = '';
    p.stderr.on('data', (d) => (erro += d));
    p.on('close', (codigo) => {
      try {
        if (codigo !== 0) throw new Error(erro.trim().slice(-300) || `código ${codigo}`);
        fs.mkdirSync(PASTA_MODELO, { recursive: true });
        for (const a of Object.values(ARQUIVOS)) fs.renameSync(path.join(pastaTmp, a), path.join(PASTA_MODELO, a));
        log.info('[audio] modelo de transcrição pronto.');
        resolve(true);
      } catch (e) {
        log.warn(`[audio] não consegui baixar o modelo de transcrição: ${e.message}`);
        resolve(false);
      } finally {
        fs.rmSync(pastaTmp, { recursive: true, force: true });
        baixando = null;
      }
    });
  });
  return baixando;
}

let reconhecedor = null;
let timerSoltar = null;
function obterReconhecedor() {
  clearTimeout(timerSoltar);
  timerSoltar = setTimeout(() => (reconhecedor = null), 10 * 60 * 1000);
  timerSoltar.unref?.();
  if (reconhecedor) return reconhecedor;
  const sherpa = require('sherpa-onnx-node');
  reconhecedor = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      whisper: {
        encoder: path.join(PASTA_MODELO, ARQUIVOS.encoder),
        decoder: path.join(PASTA_MODELO, ARQUIVOS.decoder),
        language: 'pt',
        task: 'transcribe',
      },
      tokens: path.join(PASTA_MODELO, ARQUIVOS.tokens),
      numThreads: 2,
      provider: 'cpu',
      debug: 0,
    },
  });
  return reconhecedor;
}

/** Áudio do WhatsApp (ogg/opus) → amostras a 16 kHz, mono. */
async function decodificar(buffer) {
  const { OggOpusDecoder } = await import('ogg-opus-decoder');
  const dec = new OggOpusDecoder();
  await dec.ready;
  try {
    const { channelData, sampleRate } = await dec.decodeFile(new Uint8Array(buffer));
    if (!channelData?.length || !channelData[0]?.length) return null;
    const mono = channelData[0];
    if (channelData.length > 1) for (let i = 0; i < mono.length; i++) mono[i] = (mono[i] + channelData[1][i]) / 2;
    return reamostrar(mono, sampleRate, 16000);
  } finally {
    dec.free();
  }
}

/** Reamostragem simples (média das amostras de cada janela), suficiente para fala. */
function reamostrar(amostras, de, para) {
  if (de === para) return amostras;
  const razao = de / para;
  const n = Math.floor(amostras.length / razao);
  const saida = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const ini = Math.floor(i * razao);
    const fim = Math.min(amostras.length, Math.floor((i + 1) * razao));
    let soma = 0;
    for (let j = ini; j < fim; j++) soma += amostras[j];
    saida[i] = soma / Math.max(1, fim - ini);
  }
  return saida;
}

/** Corta em trechos de até 28 s, de preferência num silêncio, para não partir palavras. */
function dividirEmTrechos(amostras, taxa = 16000) {
  const max = TRECHO_SEGUNDOS * taxa;
  const trechos = [];
  let ini = 0;
  while (amostras.length - ini > max) {
    let corte = ini + max;
    let menor = Infinity;
    const janela = Math.floor(taxa * 0.1);
    for (let p = ini + max - 4 * taxa; p < ini + max - janela; p += janela) {
      let energia = 0;
      for (let k = p; k < p + janela; k++) energia += amostras[k] * amostras[k];
      if (energia < menor) {
        menor = energia;
        corte = p + Math.floor(janela / 2);
      }
    }
    trechos.push(amostras.subarray(ini, corte));
    ini = corte;
  }
  if (amostras.length - ini > taxa * 0.3) trechos.push(amostras.subarray(ini));
  return trechos;
}

// Um áudio por vez (o servidor é pequeno): os outros esperam na fila.
let fila = Promise.resolve();

/**
 * Transcreve um áudio do WhatsApp. Devolve o texto, '' se não tem fala, ou null se não deu para transcrever.
 */
export async function transcreverAudio(buffer, log = console) {
  if (!buffer?.length) return null;
  if (!modeloPronto()) {
    prepararModelo(log);
    return null;
  }
  const tarefa = fila.then(async () => {
    const inicio = Date.now();
    let amostras = await decodificar(buffer);
    if (!amostras) return null;
    if (amostras.length > MAX_SEGUNDOS * 16000) amostras = amostras.subarray(0, MAX_SEGUNDOS * 16000);
    const rec = obterReconhecedor();
    const partes = [];
    for (const trecho of dividirEmTrechos(amostras)) {
      const stream = rec.createStream();
      stream.acceptWaveform({ samples: trecho, sampleRate: 16000 });
      rec.decode(stream);
      const t = String(rec.getResult(stream)?.text || '').trim();
      if (t) partes.push(t);
    }
    const texto = limparTranscricao(partes.join(' '));
    log.info(`[audio] áudio de ${Math.round(amostras.length / 16000)} s transcrito em ${Math.round((Date.now() - inicio) / 1000)} s.`);
    return texto;
  });
  fila = tarefa.catch(() => {});
  try {
    return await tarefa;
  } catch (e) {
    log.warn(`[audio] não consegui transcrever: ${e.message}`);
    return null;
  }
}

/** Tira repetições e "legendas fantasmas" que o Whisper às vezes inventa em silêncio. */
export function limparTranscricao(t) {
  let s = String(t || '').replace(/\s+/g, ' ').trim();
  if (/^(\[.*\]|\(.*\))$/.test(s)) return '';
  if (/^(legendas? (pela|por)|obrigad[oa] por assistir|inscreva-se)/i.test(s)) return '';
  return s;
}
