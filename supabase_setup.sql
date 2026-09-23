-- ============================================================================
-- Tabela `leads` — captura das simulações do site + campos de acompanhamento
-- do CRM (status do funil, notas e valor fechado).
-- ============================================================================

create table if not exists public.leads (
  id text primary key,
  nome text,
  whatsapp text,
  data_inicio date,
  data_fim date,
  responsavel text,
  tipo_obra text,
  situacao text,
  categoria text,
  estado text,
  destinacao text,
  area_principal numeric,
  area_piscina numeric,
  observacoes text,
  inss_estimado numeric,
  economia_estimada numeric,
  percentual_reducao numeric,
  valor_apos_reducao numeric,
  created_at timestamptz not null default now(),

  -- Campos do CRM
  status text not null default 'novo'
    check (status in ('novo', 'contatado', 'proposta_enviada', 'decidindo', 'fechado', 'perdido')),
  notas text,
  valor_fechado numeric,
  honorarios numeric,
  updated_at timestamptz not null default now()
);

-- Se a tabela `leads` já existia antes deste campo ser adicionado, rode só esta linha:
-- alter table public.leads add column if not exists honorarios numeric;

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- Atualiza `updated_at` sozinho a cada UPDATE
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Segurança (RLS): ninguém lê ou edita sem estar logado no CRM.
-- A gravação de novos leads (pelo site público) continua sendo feita só
-- pela função /api/notify-lead.js, que usa a chave service_role e por isso
-- ignora RLS — não precisa de policy de INSERT aqui.
-- ============================================================================
alter table public.leads enable row level security;

drop policy if exists "Authenticated users can read leads" on public.leads;
create policy "Authenticated users can read leads"
  on public.leads for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can update leads" on public.leads;
create policy "Authenticated users can update leads"
  on public.leads for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete leads" on public.leads;
create policy "Authenticated users can delete leads"
  on public.leads for delete
  to authenticated
  using (true);

-- ============================================================================
-- Tabela `guia_leads` — contatos que baixaram o guia gratuito em PDF
-- ("5 erros que fazem construtoras pagarem mais INSS de obra"), captados
-- pela seção GuiaGratuito antes de fazerem uma simulação completa.
-- Gravada só pela função /api/notify-guia-lead.js (chave service_role).
-- ============================================================================
create table if not exists public.guia_leads (
  id text primary key,
  nome text,
  whatsapp text,
  created_at timestamptz not null default now()
);

create index if not exists guia_leads_created_at_idx on public.guia_leads (created_at desc);

alter table public.guia_leads enable row level security;

drop policy if exists "Authenticated users can read guia_leads" on public.guia_leads;
create policy "Authenticated users can read guia_leads"
  on public.guia_leads for select
  to authenticated
  using (true);
