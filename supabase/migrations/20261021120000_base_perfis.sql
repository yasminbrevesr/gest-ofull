-- =============================================================================
-- Etapa 1: base do sistema e perfis de usuário
-- - Função padrão de updated_at
-- - Tabela profiles (1 por usuário do Supabase Auth), criada automaticamente
--   no cadastro, com o aceite dos termos (LGPD)
-- - is_admin(): usada pelas políticas de RLS das tabelas administradas
-- =============================================================================

-- Atualiza updated_at em todo UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  person_type text check (person_type in ('pf', 'mei', 'empresa')),
  tax_regime text check (tax_regime in ('mei', 'simples', 'outro')),
  default_tax_rate numeric(5, 2) not null default 0 check (default_tax_rate between 0 and 100),
  -- Respostas do cadastro inicial (personalizam a jornada).
  has_ml_account boolean,
  has_cnpj boolean,
  has_products boolean,
  onboarding_completed_at timestamptz,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  -- Só pode ser alterado direto no banco (ver docs/configuracao.md).
  role text not null default 'user' check (role in ('user', 'admin')),
  terms_version text,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Dados do usuário e do negócio. Criado automaticamente no cadastro.';
comment on column public.profiles.default_tax_rate is 'Alíquota de imposto padrão (%) usada pela calculadora.';
comment on column public.profiles.role is 'user ou admin. Alterar somente via SQL Editor.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: ler o próprio"
on public.profiles for select
to authenticated
using (user_id = (select auth.uid()));

create policy "profiles: editar o próprio"
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- O perfil é criado pelo gatilho de cadastro e apagado junto com o usuário.
-- O usuário só pode alterar as colunas abaixo (role e user_id ficam de fora).
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (
  full_name, person_type, tax_regime, default_tax_rate,
  has_ml_account, has_cnpj, has_products, onboarding_completed_at,
  theme, terms_version, terms_accepted_at
) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Criação automática do perfil no cadastro
-- O app envia full_name e terms_version nos metadados do signUp. O horário do
-- aceite é o do servidor (não confiamos no relógio do navegador).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  accepted_version text := nullif(left(meta ->> 'terms_version', 20), '');
begin
  insert into public.profiles (user_id, full_name, terms_version, terms_accepted_at)
  values (
    new.id,
    left(coalesce(nullif(trim(meta ->> 'full_name'), ''), nullif(trim(meta ->> 'name'), ''), ''), 120),
    accepted_version,
    case when accepted_version is not null then now() end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- is_admin(): true se o usuário logado tem role = 'admin'
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
