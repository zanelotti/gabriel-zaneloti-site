/**
 * Botão "Clientes para agir" do Painel da Lia (pedido do Gabriel, 26/11/2026).
 *   node scripts/clientes-para-agir.js           -> mostra a lista na tela (não muda nada)
 *   node scripts/clientes-para-agir.js --email   -> também manda a lista por e-mail
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';
import { analisarClientes, erroLegivel, montarEmail, montarTexto } from '../src/clientes-para-agir.js';
import { criarNotificador } from '../src/notify.js';

const db = createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
const anthropic = new Anthropic({ apiKey: config.anthropicKey });

try {
  const r = await analisarClientes({ db, anthropic, modelo: config.modelo });
  console.log(montarTexto(r));
  if (process.argv.includes('--email')) {
    const { assunto, html } = montarEmail(r);
    const ok = await criarNotificador({ resendKey: config.resendKey, para: config.emailAviso }).enviar(assunto, html);
    console.log(ok ? '\nE-mail enviado.' : '\nNão consegui mandar o e-mail.');
  }
} catch (e) {
  console.error(`ERRO: ${erroLegivel(e.message)}. Espere 2 minutos e clique de novo.`);
  process.exit(1);
}
