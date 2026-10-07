-- ============================================================================
-- Tabela `agendamentos` — consultorias gratuitas (~10 min) agendadas pelo site.
-- Guarda os dados de contato + a ORIGEM do clique (gclid/gbraid/wbraid e UTMs),
-- que servem pra montar públicos e enviar conversões offline ao Google Ads
-- (ver aba "Agenda" do CRM). Gravada só pela função /api/agendar.js (chave
-- service_role); o CRM (usuário logado) lê, muda o status e remove.
-- O índice único abaixo impede dois agendamentos ativos no mesmo horário.
-- ============================================================================
create table if not exists public.agendamentos (
  id text primary key,
  nome text not null,
  email text not null,
  whatsapp text not null,                 -- só dígitos, com DDD
  inicio timestamptz not null,
  fim timestamptz not null,
  observacoes text,
  status text not null default 'agendado'
    check (status in ('agendado', 'realizado', 'nao_compareceu', 'cancelado')),
  google_event_id text,
  google_event_link text,

  -- Origem / rastreamento
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  gclid text,
  gbraid text,
  wbraid text,
  landing_page text,
  referrer text,
  visitor_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agendamentos_inicio_ativo_idx
  on public.agendamentos (inicio) where status = 'agendado';
create index if not exists agendamentos_inicio_idx on public.agendamentos (inicio desc);
create index if not exists agendamentos_whatsapp_idx on public.agendamentos (whatsapp);

drop trigger if exists agendamentos_set_updated_at on public.agendamentos;
create trigger agendamentos_set_updated_at
  before update on public.agendamentos
  for each row execute function public.set_updated_at();

alter table public.agendamentos enable row level security;

drop policy if exists "Authenticated users can read agendamentos" on public.agendamentos;
create policy "Authenticated users can read agendamentos"
  on public.agendamentos for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can update agendamentos" on public.agendamentos;
create policy "Authenticated users can update agendamentos"
  on public.agendamentos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete agendamentos" on public.agendamentos;
create policy "Authenticated users can delete agendamentos"
  on public.agendamentos for delete
  to authenticated
  using (true);
