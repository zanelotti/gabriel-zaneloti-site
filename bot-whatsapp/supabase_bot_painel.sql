-- ============================================================================
-- Painel do bot dentro do CRM. Rode UMA vez no Supabase:
-- Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
-- (Precisa ter rodado antes o supabase_bot.sql.) Pode rodar de novo sem problema.
-- ============================================================================

-- 1) Configurações do bot (uma única linha, id = 1). Quem cria a linha é o próprio bot,
--    na primeira vez que ligar, copiando o que está no arquivo .env.
create table if not exists public.bot_config (
  id int primary key default 1 check (id = 1),
  ativo boolean not null default true,                 -- liga/desliga geral
  assistente_nome text not null default 'Lia',
  teto_mensagens_24h int not null default 120,         -- trava de segurança
  economia_min_reuniao numeric not null default 5000,  -- abaixo disso o bot não oferece reunião
  lista_teste text not null default '',                -- números separados por vírgula; vazio = fala com todos os leads
  horario_ativo boolean not null default false,        -- se true, só funciona dentro da janela abaixo
  horario_inicio text not null default '08:00',        -- horário de Brasília (HH:MM)
  horario_fim text not null default '20:00',
  cambio_usd_brl numeric not null default 5.5,         -- só para estimar o custo no painel
  atualizado_em timestamptz not null default now()
);

-- 2) Conhecimento editável pelo CRM (substitui a necessidade de mexer nos arquivos).
create table if not exists public.bot_conhecimento (
  id bigint generated always as identity primary key,
  chave text unique,                 -- nome do arquivo de origem (quando veio da pasta conhecimento)
  titulo text not null,
  conteudo text not null default '',
  ativo boolean not null default true,
  ordem int not null default 100,
  atualizado_em timestamptz not null default now()
);

-- 3) Comandos do CRM para o bot (enviar mensagem, assumir, devolver).
create table if not exists public.bot_comandos (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('enviar', 'assumir', 'devolver')),
  conversa_id uuid not null references public.bot_conversas (id) on delete cascade,
  texto text,
  status text not null default 'pendente' check (status in ('pendente', 'feito', 'erro')),
  erro text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);
create index if not exists bot_comandos_status_idx on public.bot_comandos (status, criado_em);

-- 4) Consumo real de tokens da API (para o painel mostrar o custo).
create table if not exists public.bot_uso (
  id bigint generated always as identity primary key,
  conversa_id uuid references public.bot_conversas (id) on delete cascade,
  entrada int not null default 0,
  saida int not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists bot_uso_criado_idx on public.bot_uso (criado_em);

-- 5) Quando a consultoria foi marcada pelo bot (métrica do painel).
alter table public.bot_conversas add column if not exists agendou_em timestamptz;

-- 6) Nome pelo qual a pessoa pediu para ser chamada (quando o cadastro tem nome de empresa ou está vazio).
alter table public.bot_conversas add column if not exists nome_contato text;

-- ----------------------------------------------------------------------------
-- Segurança: só quem está logado no CRM (usuário autenticado) acessa pelo navegador.
-- O bot usa a chave secreta (service_role), que ignora o RLS.
-- ----------------------------------------------------------------------------
alter table public.bot_config enable row level security;
alter table public.bot_conhecimento enable row level security;
alter table public.bot_comandos enable row level security;
alter table public.bot_uso enable row level security;

-- Leitura das tabelas do bot
drop policy if exists "crm le bot_conversas" on public.bot_conversas;
create policy "crm le bot_conversas" on public.bot_conversas for select to authenticated using (true);

drop policy if exists "crm le bot_mensagens" on public.bot_mensagens;
create policy "crm le bot_mensagens" on public.bot_mensagens for select to authenticated using (true);

drop policy if exists "crm le bot_estado" on public.bot_estado;
create policy "crm le bot_estado" on public.bot_estado for select to authenticated using (true);

drop policy if exists "crm le bot_uso" on public.bot_uso;
create policy "crm le bot_uso" on public.bot_uso for select to authenticated using (true);

-- Configurações: ler e alterar
drop policy if exists "crm le bot_config" on public.bot_config;
create policy "crm le bot_config" on public.bot_config for select to authenticated using (true);
drop policy if exists "crm altera bot_config" on public.bot_config;
create policy "crm altera bot_config" on public.bot_config for update to authenticated using (true) with check (true);

-- Conhecimento: ler, criar, alterar, apagar
drop policy if exists "crm le bot_conhecimento" on public.bot_conhecimento;
create policy "crm le bot_conhecimento" on public.bot_conhecimento for select to authenticated using (true);
drop policy if exists "crm cria bot_conhecimento" on public.bot_conhecimento;
create policy "crm cria bot_conhecimento" on public.bot_conhecimento for insert to authenticated with check (true);
drop policy if exists "crm altera bot_conhecimento" on public.bot_conhecimento;
create policy "crm altera bot_conhecimento" on public.bot_conhecimento for update to authenticated using (true) with check (true);
drop policy if exists "crm apaga bot_conhecimento" on public.bot_conhecimento;
create policy "crm apaga bot_conhecimento" on public.bot_conhecimento for delete to authenticated using (true);

-- Comandos: o CRM cria e lê; quem executa é o bot
drop policy if exists "crm le bot_comandos" on public.bot_comandos;
create policy "crm le bot_comandos" on public.bot_comandos for select to authenticated using (true);
drop policy if exists "crm cria bot_comandos" on public.bot_comandos;
create policy "crm cria bot_comandos" on public.bot_comandos for insert to authenticated with check (status = 'pendente');
