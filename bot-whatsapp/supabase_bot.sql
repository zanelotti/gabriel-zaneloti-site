-- ============================================================================
-- Tabelas do bot de WhatsApp. Rode UMA vez no Supabase:
-- Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
-- ============================================================================

create extension if not exists pgcrypto;

-- Uma linha por lead contatado pelo bot. O índice único em lead_id impede que o
-- mesmo lead receba a abertura duas vezes, mesmo que o bot reinicie.
create table if not exists public.bot_conversas (
  id uuid primary key default gen_random_uuid(),
  lead_id text not null unique,
  telefone text not null,          -- só dígitos, com 55 (ex.: 5511912345678)
  jid text,                        -- identificador do contato no WhatsApp
  estado text not null default 'ativa'
    check (estado in ('ativa', 'humano', 'encerrada', 'optout')),
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists bot_conversas_telefone_idx on public.bot_conversas (telefone);

-- Todas as mensagens: do lead, do bot e as que o Gabriel mandou à mão.
create table if not exists public.bot_mensagens (
  id bigint generated always as identity primary key,
  conversa_id uuid not null references public.bot_conversas (id) on delete cascade,
  direcao text not null check (direcao in ('lead', 'bot', 'humano')),
  texto text not null,
  wa_id text,
  criado_em timestamptz not null default now()
);

create index if not exists bot_mensagens_conversa_idx on public.bot_mensagens (conversa_id, criado_em);
create index if not exists bot_mensagens_bot_idx on public.bot_mensagens (direcao, criado_em);

-- Valores guardados pelo bot (ex.: quando ele foi ligado pela primeira vez).
create table if not exists public.bot_estado (
  chave text primary key,
  valor text not null
);

-- Segurança: ninguém acessa estas tabelas pelo navegador. O bot usa a chave
-- service_role, que ignora o RLS, então não precisa de policy.
alter table public.bot_conversas enable row level security;
alter table public.bot_mensagens enable row level security;
alter table public.bot_estado enable row level security;
