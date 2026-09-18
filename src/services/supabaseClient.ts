import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase usado exclusivamente pelo CRM interno (/crm.html).
 *
 * Usa a chave `anon` (pública, segura para o navegador — protegida pelas
 * políticas de RLS da tabela `leads`, que só liberam leitura/escrita para
 * usuários autenticados). O site público (calculadora) não importa este
 * arquivo: a gravação de novos leads continua passando pela função
 * serverless `/api/notify-lead.js`, que usa a chave service_role.
 *
 * Se as variáveis não estiverem configuradas, exportamos `null` e as telas
 * do CRM mostram uma mensagem explicando o que falta, em vez de quebrar.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
