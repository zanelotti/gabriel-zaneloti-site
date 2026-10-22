/**
 * Configuração do bot. Tudo vem do arquivo .env (copie o .env.example e preencha).
 */
import 'dotenv/config';

const num = (v, padrao) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : padrao;
};

const lista = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean);

export const config = {
  // --- Obrigatórias ---
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anthropicKey: process.env.ANTHROPIC_API_KEY,

  // --- Opcionais ---
  modelo: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
  siteUrl: (process.env.SITE_URL || 'https://www.gabrielzaneloti.com.br').replace(/\/$/, ''),
  resendKey: process.env.RESEND_API_KEY || '',
  emailAviso: process.env.LEAD_NOTIFICATION_EMAIL || 'comercial.mfzeng@gmail.com',

  // --- Comportamento ---
  // O bot funciona 24h por dia: não existe janela de horário.
  pollMs: num(process.env.POLL_MS, 5000), // de quanto em quanto tempo procura leads novos
  aberturaMinMs: num(process.env.ABERTURA_MIN_MS, 4000), // pausa antes da 1ª mensagem (parece digitação)
  aberturaMaxMs: num(process.env.ABERTURA_MAX_MS, 12000),
  debounceMs: num(process.env.DEBOUNCE_MS, 15000), // espera o lead terminar de escrever antes de responder
  maxIdadeLeadHoras: num(process.env.MAX_IDADE_LEAD_HORAS, 48), // não abre conversa com lead mais antigo que isso
  // Trava de segurança contra erro/loop: máximo de mensagens do bot em 24h (não é meta, é teto).
  tetoMensagens24h: num(process.env.TETO_MENSAGENS_24H, 120),
  // Abaixo desta economia estimada o bot NÃO oferece reunião: passa o lead para o Gabriel conversar por texto.
  economiaMinParaReuniao: num(process.env.ECONOMIA_MIN_PARA_REUNIAO, 5000),

  // Se preenchido (números separados por vírgula, só dígitos), o bot só fala com esses números.
  // Use para o primeiro teste. Deixe vazio em produção.
  listaTeste: lista(process.env.LISTA_TESTE),
  // MODO_TESTE=1 escreve no console o que enviaria, sem enviar nada no WhatsApp.
  modoTeste: process.env.MODO_TESTE === '1',

  arquivoParar: process.env.ARQUIVO_PARAR || 'PARAR.txt',

  // Nome do assistente nas conversas (aparece na primeira mensagem).
  assistenteNome: process.env.ASSISTENTE_NOME || 'Lia',
};

export function validarConfig() {
  const faltando = [];
  if (!config.supabaseUrl) faltando.push('SUPABASE_URL');
  if (!config.supabaseKey) faltando.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.anthropicKey) faltando.push('ANTHROPIC_API_KEY');
  return faltando;
}
