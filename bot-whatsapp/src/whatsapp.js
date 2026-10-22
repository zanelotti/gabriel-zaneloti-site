/**
 * Conexão com o WhatsApp por QR code (biblioteca Baileys, não oficial).
 *
 * Funciona como o "WhatsApp Web": você escaneia um QR code uma vez com o celular
 * (Configurações → Aparelhos conectados) e a sessão fica salva na pasta `auth/`.
 * Seu WhatsApp no celular continua funcionando normalmente ao mesmo tempo.
 *
 * ATENÇÃO: não é a API oficial. O WhatsApp pode restringir números que usam
 * automação. As proteções do bot reduzem o risco, mas não o eliminam.
 */
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  isLidUser,
  isPnUser,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { aleatorio, dormir } from './util.js';

const digitosDoJid = (jid) => String(jid).split('@')[0].split(':')[0];
const IGNORAR_JID = (jid) =>
  !jid || jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@broadcast') || jid.endsWith('@newsletter');

export function criarWhatsApp({ pastaAuth = 'auth', log = console, modoTeste = false, aoReceber, aoHumano, aoNaoIdentificado, aoDeslogar }) {
  let sock = null;
  let conectado = false;
  let encerrando = false;
  const enviados = new Set(); // ids de mensagens enviadas pelo bot (para distinguir das que o Gabriel digita)

  async function resolverTelefone(key) {
    const candidatos = [key.remoteJidAlt, key.remoteJid].filter(Boolean);
    for (const c of candidatos) if (isPnUser(c)) return digitosDoJid(c);
    const lid = candidatos.find((c) => isLidUser(c));
    if (lid) {
      try {
        const pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(lid);
        if (pn) return digitosDoJid(pn);
      } catch (e) {
        log.warn('[whatsapp] não consegui converter LID em telefone:', e.message);
      }
    }
    return null;
  }

  async function tratar(m) {
    const key = m.key;
    const jid = key?.remoteJid;
    if (IGNORAR_JID(jid) || !m.message) return;

    const conteudo = m.message.ephemeralMessage?.message || m.message.viewOnceMessage?.message || m.message;
    const soTecnica = Object.keys(conteudo).every((k) => ['reactionMessage', 'protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo'].includes(k));
    if (soTecnica) return;

    const texto =
      conteudo.conversation ||
      conteudo.extendedTextMessage?.text ||
      conteudo.imageMessage?.caption ||
      conteudo.videoMessage?.caption ||
      conteudo.documentMessage?.caption ||
      '';
    let tipo = 'texto';
    if (!texto) {
      if (conteudo.audioMessage) tipo = 'áudio';
      else if (conteudo.imageMessage) tipo = 'imagem';
      else if (conteudo.videoMessage) tipo = 'vídeo';
      else if (conteudo.documentMessage) tipo = 'documento';
      else if (conteudo.stickerMessage) tipo = 'figurinha';
      else tipo = 'conteúdo não suportado';
    }

    if (key.fromMe) {
      await dormir(1500); // dá tempo de o envio do próprio bot ser registrado em `enviados`
      if (enviados.has(key.id)) return;
    }

    const telefone = await resolverTelefone(key);
    if (!telefone) {
      if (!key.fromMe) await aoNaoIdentificado?.({ jid, texto, tipo });
      return;
    }

    if (key.fromMe) await aoHumano({ telefone, texto, waId: key.id });
    else await aoReceber({ telefone, jid, texto, tipo, waId: key.id });
  }

  async function iniciar() {
    if (modoTeste) {
      conectado = true;
      log.info('[whatsapp] MODO_TESTE: nada será enviado de verdade.');
      return;
    }
    const { state, saveCreds } = await useMultiFileAuthState(pastaAuth);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Assistente Gabriel Zaneloti', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        log.info('\nEscaneie este QR code com o WhatsApp do celular (Configurações → Aparelhos conectados → Conectar um aparelho):\n');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        conectado = true;
        log.info('[whatsapp] conectado.');
      }
      if (connection === 'close') {
        conectado = false;
        if (encerrando) return;
        const codigo = lastDisconnect?.error?.output?.statusCode;
        if (codigo === DisconnectReason.loggedOut) {
          log.error('[whatsapp] A sessão foi desconectada pelo celular. Apague a pasta "auth" e inicie de novo para ler um novo QR code.');
          aoDeslogar?.();
          return;
        }
        log.warn(`[whatsapp] conexão caiu (código ${codigo ?? 'desconhecido'}). Reconectando em 5s...`);
        setTimeout(() => iniciar().catch((e) => log.error('[whatsapp] erro ao reconectar:', e.message)), 5000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const m of messages) {
        try {
          await tratar(m);
        } catch (e) {
          log.error('[whatsapp] erro ao tratar mensagem:', e.message);
        }
      }
    });
  }

  /** Confere se o número tem WhatsApp e devolve o identificador (jid), ou null. */
  async function resolverJid(telefone55) {
    if (modoTeste) return `${telefone55}@s.whatsapp.net`;
    const [r] = (await sock.onWhatsApp(telefone55)) || [];
    return r?.exists ? r.jid : null;
  }

  /** Envia texto simulando digitação. Devolve o id da mensagem. */
  async function enviarTexto(jid, texto) {
    if (modoTeste) {
      log.info(`[TESTE] → ${jid}: ${texto}`);
      return `teste-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    }
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
    await dormir(Math.min(7000, 1200 + texto.length * 25) + aleatorio(0, 800));
    await sock.sendPresenceUpdate('paused', jid);
    const r = await sock.sendMessage(jid, { text: texto });
    const id = r?.key?.id;
    if (id) {
      enviados.add(id);
      if (enviados.size > 500) enviados.delete(enviados.values().next().value);
    }
    return id || null;
  }

  async function encerrar() {
    encerrando = true;
    try {
      sock?.end?.(undefined);
    } catch {
      /* já fechado */
    }
  }

  return { iniciar, resolverJid, enviarTexto, conectado: () => conectado, encerrar };
}
