-- ============================================================================
-- Tabela `parceiros` — profissionais cadastrados em /parceiros.html
-- (engenheiros, contadores, arquitetos...). Cada um tem um `codigo` que vai no
-- link /?ref=codigo; os leads que chegam por esse link trazem o mesmo código
-- (aparece nas notas do lead e no e-mail da simulação).
-- Gravada só pela função /api/notify-parceiro.js (chave service_role); o CRM
-- (usuário logado) lê e atualiza. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================================
create table if not exists public.parceiros (
  codigo text primary key,
  nome text not null,
  profissao text,
  cidade text,
  whatsapp text not null,                 -- só dígitos, com DDD
  email text not null,
  contrato_enviado boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now()
);

alter table public.parceiros enable row level security;

drop policy if exists "Authenticated users can read parceiros" on public.parceiros;
create policy "Authenticated users can read parceiros"
  on public.parceiros for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can update parceiros" on public.parceiros;
create policy "Authenticated users can update parceiros"
  on public.parceiros for update
  to authenticated
  using (true)
  with check (true);
