-- =============================================================================
-- SOMENTE PARA TESTE LOCAL (scripts/testar-banco.sh). NÃO rodar no Supabase.
-- Imita o mínimo do ambiente do Supabase (papéis, auth, storage, vault,
-- pg_net e pg_cron) para validar as migrations e o RLS num Postgres comum.
-- =============================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant anon, authenticated, service_role to current_user;

create schema extensions;
create schema auth;
create schema storage;
create schema vault;
create schema net;
create schema cron;

grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;

-- Privilégios padrão iguais aos do Supabase.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- auth --------------------------------------------------------------------
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- storage -----------------------------------------------------------------
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant all on storage.objects to anon, authenticated, service_role;

create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- vault / pg_net / pg_cron (simulados) -------------------------------------
create table vault.secrets (name text primary key, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(secret text, name text) returns uuid language sql as $$
  insert into vault.secrets values (name, secret) on conflict (name) do update set secret = excluded.secret;
  select gen_random_uuid();
$$;

create table net.requests (id bigserial primary key, url text, headers jsonb, body jsonb, created_at timestamptz default now());
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
returns bigint language sql as $$
  insert into net.requests (url, headers, body) values (url, headers, body) returning id;
$$;

create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid;
$$;
create function cron.unschedule(job_name text) returns boolean language sql as $$
  with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d);
$$;

-- Ferramentas dos testes -----------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Cria um usuário (dispara o gatilho de perfil) e devolve o id.
create function tests.create_user(email text, meta jsonb default '{}'::jsonb) returns uuid language sql as $$
  insert into auth.users (email, raw_user_meta_data) values (email, meta) returning id;
$$;

-- Simula o usuário logado no PostgREST. Use `set role authenticated` depois.
create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;
grant execute on function tests.login(uuid) to authenticated, anon;

create function tests.assert(condition boolean, message text) returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'FALHOU: %', message;
  end if;
  raise notice 'ok: %', message;
end;
$$;
grant execute on function tests.assert(boolean, text) to anon, authenticated, service_role;

-- Confere que um comando falha com a mensagem esperada (trecho).
create function tests.assert_fails(command text, expected text, message text) returns void language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if position(lower(expected) in lower(sqlerrm)) > 0 then
      raise notice 'ok: %', message;
      return;
    end if;
    raise exception 'FALHOU: % (erro inesperado: %)', message, sqlerrm;
  end;
  raise exception 'FALHOU: % (o comando deveria ter falhado)', message;
end;
$$;
grant execute on function tests.assert_fails(text, text, text) to anon, authenticated, service_role;
