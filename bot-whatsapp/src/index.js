/**
 * Ponto de entrada do bot: `npm start` (ou iniciar.bat no Windows).
 */
import { existsSync } from 'node:fs';
import { criarBot } from './bot.js';
import { criarCerebro } from './brain.js';
import { config, validarConfig } from './config.js';
import { criarNotificador } from './notify.js';
import { criarSite } from './site.js';
import { criarStore } from './store.js';
import { dormir } from './util.js';
import { criarWhatsApp } from './whatsapp.js';

const log = {
  info: (...a) => console.log(new Date().toLocaleTimeString('pt-BR'), ...a),
  warn: (...a) => console.warn(new Date().toLocaleTimeString('pt-BR'), ...a),
  error: (...a) => console.error(new Date().toLocaleTimeString('pt-BR'), ...a),
};

const faltando = validarConfig();
if (faltando.length) {
  log.error(`Faltam variáveis no arquivo .env: ${faltando.join(', ')}. Copie o .env.example para .env e preencha.`);
  process.exit(10); // 10 = precisa de ação sua; o iniciar.bat não reinicia sozinho
}

const parado = () => process.env.BOT_ATIVO === '0' || existsSync(config.arquivoParar);

const store = criarStore({ url: config.supabaseUrl, key: config.supabaseKey });
const site = criarSite({ siteUrl: config.siteUrl });
const notificar = criarNotificador({ resendKey: config.resendKey, para: config.emailAviso, log });
const cerebro = criarCerebro({ apiKey: config.anthropicKey, modelo: config.modelo, config });

let bot;
const wa = criarWhatsApp({
  pastaAuth: 'auth',
  log,
  modoTeste: config.modoTeste,
  aoReceber: (m) => bot.aoReceber(m),
  aoHumano: (m) => bot.aoHumano(m),
  aoNaoIdentificado: async ({ jid, texto, tipo }) => {
    log.warn(`[whatsapp] mensagem de contato não identificado (${jid}): ${tipo}`);
    await notificar.enviar(
      'Bot WhatsApp: mensagem que não consegui associar a um lead',
      `<p>Chegou uma mensagem (${tipo}) de um contato que o bot não conseguiu associar a nenhum lead: <em>${String(texto || '').slice(0, 300).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</em>. Veja no seu WhatsApp.</p>`
    );
  },
  aoDeslogar: () => process.exit(10),
});

bot = criarBot({ store, wa, cerebro, site, notificar, config, log, parado });

async function principal() {
  log.info('Iniciando o bot de WhatsApp do Gabriel...');
  if (config.listaTeste.length) log.warn(`LISTA_TESTE ativa: o bot só fala com ${config.listaTeste.join(', ')}.`);
  if (config.modoTeste) log.warn('MODO_TESTE ativo: nenhuma mensagem será enviada de verdade.');
  await wa.iniciar();

  let avisouParado = false;
  for (;;) {
    try {
      if (parado()) {
        if (!avisouParado) log.warn(`Bot PARADO (arquivo ${config.arquivoParar} existe ou BOT_ATIVO=0). Nada será enviado.`);
        avisouParado = true;
      } else {
        avisouParado = false;
        await bot.processarNovosLeads();
      }
    } catch (e) {
      log.error('Erro no ciclo principal:', e.message);
    }
    await dormir(config.pollMs);
  }
}

process.on('unhandledRejection', (e) => log.error('Erro não tratado:', e?.message || e));
process.on('SIGINT', async () => {
  log.info('Encerrando...');
  bot.pararTimers();
  await wa.encerrar();
  process.exit(0);
});

principal().catch((e) => {
  log.error('Falha ao iniciar:', e);
  process.exit(1);
});
