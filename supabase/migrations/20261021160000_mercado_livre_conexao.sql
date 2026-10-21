-- =============================================================================
-- Etapa 5: conexão com o Mercado Livre e importação de anúncios
-- - ml_connections: tokens (criptografados) e dados da conta. Só as Edge
--   Functions acessam a tabela; o app lê o status por get_my_ml_connection().
-- - ml_oauth_states: "state" + PKCE de cada tentativa de conexão (10 minutos)
-- - ml_listings: anúncios/variações importados e o vínculo com o estoque
-- - sync_logs: registro do que foi feito na integração (visível ao usuário)
-- - Agendamentos (pg_cron + pg_net) para chamar Edge Functions
-- =============================================================================

create table public.ml_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Uma conta do Mercado Livre só pode estar ligada a um usuário do app.
  seller_id bigint not null unique,
  nickname text,
  site_id text,
  -- Tokens criptografados (AES-GCM) pelas Edge Functions. Nunca em texto puro.
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz not null,
  scope text,
  status text not null default 'active' check (status in ('active', 'reconnect_required')),
  -- manual = o usuário clica em "enviar estoque agora"; automatic = envia sozinho.
  sync_mode text not null default 'manual' check (sync_mode in ('manual', 'automatic')),
  last_refresh_at timestamptz,
  -- Evita duas renovações de token ao mesmo tempo (o refresh token é de uso único).
  refresh_lock_until timestamptz,
  last_error text,
  last_import_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status in ('success', 'partial', 'error')),
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ml_connections_set_updated_at before update on public.ml_connections
for each row execute function public.set_updated_at();

create table public.ml_oauth_states (
  -- sha256 do "state" enviado ao Mercado Livre.
  state_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_verifier text,
  redirect_uri text not null,
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ml_oauth_states_user_idx on public.ml_oauth_states (user_id);

create table public.ml_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ml_item_id text not null,
  -- 0 = anúncio sem variação.
  ml_variation_id bigint not null default 0,
  title text not null,
  variation_label text,
  seller_sku text,
  permalink text,
  thumbnail text,
  price numeric(12, 2),
  currency_id text,
  status text,
  -- gold_special = Clássico; gold_pro = Premium.
  listing_type_id text,
  logistic_type text,
  -- Anúncio no Full: estoque controlado pelo Mercado Livre (só leitura).
  is_full boolean not null default false,
  user_product_id text,
  inventory_id text,
  ml_available_quantity int,
  ml_checked_at timestamptz,
  -- Vínculo com o estoque.
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  link_status text not null default 'unlinked' check (link_status in ('unlinked', 'suggested', 'linked', 'ignored')),
  last_pushed_quantity int,
  last_pushed_at timestamptz,
  last_push_status text check (last_push_status in ('success', 'error', 'skipped')),
  last_push_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ml_item_id, ml_variation_id),
  constraint ml_listings_link_consistency check (
    (link_status in ('linked', 'suggested') and product_id is not null)
    or (link_status in ('unlinked', 'ignored') and product_id is null and variant_id is null)
  )
);

create index ml_listings_product_idx on public.ml_listings (product_id) where product_id is not null;
create index ml_listings_variant_idx on public.ml_listings (variant_id) where variant_id is not null;
create index ml_listings_user_status_idx on public.ml_listings (user_id, link_status);

create trigger ml_listings_set_updated_at before update on public.ml_listings
for each row execute function public.set_updated_at();

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- import | push_stock | sale | item_update | reconcile | token_refresh | connection
  kind text not null,
  status text not null check (status in ('success', 'error', 'skipped', 'info')),
  message text not null,
  ml_item_id text,
  ml_variation_id bigint,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- Detalhes técnicos (sem tokens).
  details jsonb,
  event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sync_logs_user_idx on public.sync_logs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Vínculo: o produto/variação precisa ser do mesmo usuário; produto com
-- variações exige a variação (o estoque é por variação).
-- -----------------------------------------------------------------------------
create or replace function public.validate_ml_listing_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
begin
  if new.product_id is null then
    new.variant_id := null;
    if new.link_status in ('linked', 'suggested') then
      new.link_status := 'unlinked';
    end if;
    return new;
  end if;

  select * into v_product from public.products where id = new.product_id and user_id = new.user_id;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;
  if v_product.has_variants and new.variant_id is null then
    raise exception 'Este produto tem variações: escolha a variação do anúncio' using errcode = 'P0001';
  end if;
  if not v_product.has_variants then
    new.variant_id := null;
  elsif not exists (select 1 from public.product_variants where id = new.variant_id and product_id = new.product_id) then
    raise exception 'Variação não encontrada' using errcode = 'P0002';
  end if;
  if new.link_status in ('unlinked', 'ignored') then
    new.link_status := 'linked';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_ml_listing_link() from public, anon, authenticated;

create trigger ml_listings_validate_link before insert or update of product_id, variant_id, link_status on public.ml_listings
for each row execute function public.validate_ml_listing_link();

-- Variação apagada: os anúncios ligados a ela voltam para "sem vínculo".
create or replace function public.unlink_ml_listings_of_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ml_listings set product_id = null, variant_id = null, link_status = 'unlinked' where variant_id = old.id;
  return old;
end;
$$;

revoke execute on function public.unlink_ml_listings_of_variant() from public, anon, authenticated;

create trigger product_variants_unlink_ml before delete on public.product_variants
for each row execute function public.unlink_ml_listings_of_variant();

-- -----------------------------------------------------------------------------
-- Sugestão automática de vínculo pelo SKU (SELLER_SKU do anúncio = SKU do estoque)
-- -----------------------------------------------------------------------------
create or replace function public.suggest_ml_links(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.ml_listings l
  set product_id = s.product_id, variant_id = s.variant_id, link_status = 'suggested'
  from public.stock_items s
  where l.user_id = p_user_id
    and s.user_id = p_user_id
    and l.link_status = 'unlinked'
    and l.seller_sku is not null
    and lower(btrim(l.seller_sku)) = lower(s.sku);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.suggest_ml_links(uuid) from public, anon, authenticated;
grant execute on function public.suggest_ml_links(uuid) to service_role;

create or replace function public.suggest_my_ml_links()
returns int
language sql
security definer
set search_path = ''
as $$
  select public.suggest_ml_links(auth.uid());
$$;

revoke execute on function public.suggest_my_ml_links() from public, anon;
grant execute on function public.suggest_my_ml_links() to authenticated;

-- -----------------------------------------------------------------------------
-- Status da conexão para o app (sem tokens)
-- -----------------------------------------------------------------------------
create or replace function public.get_my_ml_connection()
returns table (
  seller_id bigint,
  nickname text,
  site_id text,
  status text,
  sync_mode text,
  token_expires_at timestamptz,
  last_error text,
  last_import_at timestamptz,
  last_sync_at timestamptz,
  last_sync_status text,
  connected_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select seller_id, nickname, site_id, status, sync_mode, token_expires_at, last_error,
         last_import_at, last_sync_at, last_sync_status, connected_at
  from public.ml_connections
  where user_id = (select auth.uid());
$$;

revoke execute on function public.get_my_ml_connection() from public, anon;
grant execute on function public.get_my_ml_connection() to authenticated;

-- -----------------------------------------------------------------------------
-- RLS e permissões
-- -----------------------------------------------------------------------------
alter table public.ml_connections enable row level security;
alter table public.ml_oauth_states enable row level security;
alter table public.ml_listings enable row level security;
alter table public.sync_logs enable row level security;

-- Tokens e "state": nenhuma política = nenhum acesso pelo app (só service_role).
revoke all on public.ml_connections, public.ml_oauth_states from anon, authenticated;
revoke all on public.ml_listings, public.sync_logs from anon;

create policy "ml_listings: dono lê" on public.ml_listings for select to authenticated using (user_id = (select auth.uid()));
create policy "ml_listings: dono vincula" on public.ml_listings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- O usuário só altera o vínculo; o resto vem do Mercado Livre.
revoke insert, update, delete, truncate on public.ml_listings from authenticated;
grant update (product_id, variant_id, link_status) on public.ml_listings to authenticated;

create policy "sync_logs: dono lê" on public.sync_logs for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.sync_logs from authenticated;

-- -----------------------------------------------------------------------------
-- Agendamentos: chamam Edge Functions com o segredo do agendador.
-- Antes, cadastre no Vault (ver docs/configuracao.md):
--   select vault.create_secret('https://<projeto>.supabase.co', 'project_url');
--   select vault.create_secret('<mesmo valor do CRON_SECRET das funções>', 'cron_secret');
-- Sem esses segredos, os agendamentos não fazem nada (e não dão erro).
-- -----------------------------------------------------------------------------
-- Extensões do agendador (no Supabase já estão disponíveis; o bloco permite
-- rodar os testes locais, que simulam essas extensões).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    grant usage on schema cron to postgres;
    grant all privileges on all tables in schema cron to postgres;
  end if;
end;
$$;

create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'invoke_edge_function: cadastre project_url e cron_secret no Vault';
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := p_body,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

-- Renova tokens que vencem na próxima hora (a cada 30 minutos).
select cron.schedule('ml-refresh-tokens', '*/30 * * * *', $$select public.invoke_edge_function('ml-refresh-tokens')$$);

-- Limpa tentativas de conexão vencidas (diariamente).
select cron.schedule('ml-oauth-states-cleanup', '17 4 * * *', $$delete from public.ml_oauth_states where expires_at < now() - interval '1 day'$$);
