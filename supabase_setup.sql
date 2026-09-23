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

-- ============================================================================
-- SDR automatizado (PILOTO) — acompanhamento comercial ativo via WhatsApp.
--
-- Fica restrito a leads de teste: o gatilho abaixo só liga `sdr_ativo` para
-- leads cujo nome comece com "teste" (maiúsculas/minúsculas não importam).
-- Nenhum lead real é contatado automaticamente enquanto esse for o critério.
--
-- Quando o piloto for validado e você quiser liberar para todo mundo, troque
-- a condição da função `set_sdr_ativo()` abaixo (ex: sempre `true`) — não
-- precisa mexer em nenhum código do site.
-- ============================================================================
alter table public.leads add column if not exists sdr_ativo boolean not null default false;

alter table public.leads add column if not exists sdr_estado text not null default 'novo'
  check (sdr_estado in (
    'novo',                    -- lead simulou, o SDR ainda não mandou a primeira mensagem
    'aguardando_lead',         -- o SDR já falou, esperando o lead responder
    'follow_up_agendado',      -- o lead pediu para retornar em uma data (ver sdr_proximo_contato)
    'aguardando_gabriel',      -- a conversa chegou no ponto de falar valores; aguardando você informar os honorários
    'retomado_pos_honorarios', -- você avisou que já passou o valor; o SDR retoma para tentar fechar
    'fechado',                 -- negócio fechado
    'perdido',                 -- lead recusou / não tem mais interesse
    'pausado'                  -- você assumiu a conversa manualmente; o SDR não mexe mais nesse lead até você reativar
  ));

alter table public.leads add column if not exists sdr_proximo_contato date;

-- Histórico da conversa do SDR: array de {"em": timestamptz ISO, "de": "bot"|"lead"|"gabriel"|"sistema", "texto": "..."}
alter table public.leads add column if not exists sdr_historico jsonb not null default '[]'::jsonb;

-- Liga o SDR automaticamente só para leads de teste, na criação do lead.
create or replace function public.set_sdr_ativo()
returns trigger as $$
begin
  if new.sdr_ativo is null or new.sdr_ativo = false then
    new.sdr_ativo := (lower(trim(coalesce(new.nome, ''))) like 'teste%');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_sdr_ativo on public.leads;
create trigger leads_set_sdr_ativo
  before insert on public.leads
  for each row execute function public.set_sdr_ativo();

-- Se você já tem leads de teste cadastrados antes desta migração, rode esta
-- linha uma vez para ativar o SDR neles também:
update public.leads set sdr_ativo = true where lower(trim(nome)) like 'teste%';

-- Acrescenta uma mensagem ao histórico do SDR de forma atômica (evita
-- condição de corrida entre o robô e o painel do CRM escrevendo ao mesmo tempo).
create or replace function public.sdr_append_historico(p_id text, p_entry jsonb)
returns void as $$
begin
  update public.leads
  set sdr_historico = coalesce(sdr_historico, '[]'::jsonb) || jsonb_build_array(p_entry)
  where id = p_id;
end;
$$ language plpgsql security definer;

grant execute on function public.sdr_append_historico(text, jsonb) to authenticated, service_role;
