-- =============================================================================
-- Etapa 6: sincronização de estoque com o Mercado Livre
-- - ml_events: fila de notificações (webhook) e tarefas internas (envio de
--   estoque), com status, tentativas, próximo horário e erro registrado
-- - ml_order_items: chave única pedido + anúncio/variação = nunca baixar o
--   estoque duas vezes pela mesma venda
-- - Gatilho: movimentação de produto vinculado + modo automático = coloca o
--   envio de estoque na fila
-- - ml_stock_divergences: estoque do sistema x Mercado Livre (conferência)
-- - Agendamentos: processar a fila (1 min) e conferir estoques (1 h)
-- =============================================================================

create table public.ml_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  -- webhook = notificação do Mercado Livre; system = tarefa interna.
  source text not null check (source in ('webhook', 'system')),
  -- orders_v2 | items | stock_push
  topic text not null,
  -- /orders/123 | /items/MLB123 | stock:<product_id>:<variant_id ou 0>
  resource text not null,
  ml_user_id bigint,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'error', 'ignored')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notificações repetidas do mesmo recurso enquanto ainda não processadas viram uma só.
create unique index ml_events_pending_dedup on public.ml_events (topic, resource, user_id) where status = 'pending';
create index ml_events_queue_idx on public.ml_events (next_attempt_at) where status in ('pending', 'processing');
create index ml_events_user_idx on public.ml_events (user_id, created_at desc);

create trigger ml_events_set_updated_at before update on public.ml_events
for each row execute function public.set_updated_at();

create table public.ml_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id bigint not null,
  ml_item_id text not null,
  ml_variation_id bigint not null default 0,
  quantity int not null,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  -- applied = estoque baixado | cancelled = baixa desfeita (venda cancelada)
  -- skipped_full = venda no Full | unlinked = anúncio sem vínculo | not_applied = cancelada antes da baixa
  status text not null check (status in ('applied', 'cancelled', 'skipped_full', 'unlinked', 'not_applied')),
  sale_movement_id uuid references public.stock_movements (id) on delete set null,
  cancel_movement_id uuid references public.stock_movements (id) on delete set null,
  order_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotência: um pedido + item só é processado uma vez.
  unique (user_id, order_id, ml_item_id, ml_variation_id)
);

create trigger ml_order_items_set_updated_at before update on public.ml_order_items
for each row execute function public.set_updated_at();

alter table public.ml_connections add column divergence_count int not null default 0;
alter table public.ml_connections add column last_reconcile_at timestamptz;

-- Status da conexão passa a incluir a conferência.
drop function public.get_my_ml_connection();
create function public.get_my_ml_connection()
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
  connected_at timestamptz,
  divergence_count int,
  last_reconcile_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select seller_id, nickname, site_id, status, sync_mode, token_expires_at, last_error,
         last_import_at, last_sync_at, last_sync_status, connected_at, divergence_count, last_reconcile_at
  from public.ml_connections
  where user_id = (select auth.uid());
$$;

revoke execute on function public.get_my_ml_connection() from public, anon;
grant execute on function public.get_my_ml_connection() to authenticated;

-- -----------------------------------------------------------------------------
-- Fila
-- -----------------------------------------------------------------------------

-- Webhook: registra a notificação (uma chamada só, para responder rápido).
create or replace function public.enqueue_ml_webhook(p_topic text, p_resource text, p_ml_user_id bigint, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  select user_id into v_user from public.ml_connections where seller_id = p_ml_user_id;
  if v_user is null then
    insert into public.ml_events (source, topic, resource, ml_user_id, payload, status, last_error, processed_at)
    values ('webhook', p_topic, p_resource, p_ml_user_id, p_payload, 'ignored', 'Vendedor não conectado ao app', now())
    returning id into v_id;
    return v_id;
  end if;
  insert into public.ml_events (user_id, source, topic, resource, ml_user_id, payload)
  values (v_user, 'webhook', p_topic, p_resource, p_ml_user_id, p_payload)
  on conflict (topic, resource, user_id) where status = 'pending' do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Pega até p_limit eventos para processar (os travados há mais de 2 min voltam para a fila).
create or replace function public.claim_ml_events(p_limit int default 20, p_user_id uuid default null)
returns setof public.ml_events
language sql
security definer
set search_path = ''
as $$
  update public.ml_events e
  set status = 'processing', attempts = e.attempts + 1, locked_until = now() + interval '2 minutes'
  where e.id in (
    select id from public.ml_events
    where ((status = 'pending' and next_attempt_at <= now()) or (status = 'processing' and locked_until < now()))
      and (p_user_id is null or user_id = p_user_id)
    order by next_attempt_at
    limit p_limit
    for update skip locked
  )
  returning e.*;
$$;

revoke execute on function public.enqueue_ml_webhook(text, text, bigint, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_ml_events(int, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_ml_webhook(text, text, bigint, jsonb), public.claim_ml_events(int, uuid) to service_role;

-- Botão "reprocessar" (eventos com erro do próprio usuário).
create or replace function public.retry_ml_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ml_events
  set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null, locked_until = null
  where id = p_event_id and user_id = (select auth.uid()) and status = 'error';
  if not found then
    raise exception 'Evento não encontrado ou já reprocessado' using errcode = 'P0002';
  end if;
exception
  when unique_violation then
    -- Já existe o mesmo evento na fila: este fica como processado.
    update public.ml_events set status = 'processed', processed_at = now(), last_error = 'Substituído por evento mais recente'
    where id = p_event_id and user_id = (select auth.uid());
end;
$$;

revoke execute on function public.retry_ml_event(uuid) from public, anon;
grant execute on function public.retry_ml_event(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Vendas: baixa idempotente (pedido + item) e estorno quando cancelada
-- -----------------------------------------------------------------------------
create or replace function public.apply_ml_order_item(
  p_user_id uuid,
  p_order_id bigint,
  p_item_id text,
  p_variation_id bigint,
  p_quantity int,
  p_order_status text,
  p_is_full boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.ml_listings;
  v_row public.ml_order_items;
  v_movement public.stock_movements;
  v_ref text := 'Pedido ' || p_order_id;
  v_variation bigint := coalesce(p_variation_id, 0);
begin
  select * into v_listing from public.ml_listings
  where user_id = p_user_id and ml_item_id = p_item_id and ml_variation_id = v_variation and link_status = 'linked';

  if p_order_status = 'cancelled' then
    select * into v_row from public.ml_order_items
    where user_id = p_user_id and order_id = p_order_id and ml_item_id = p_item_id and ml_variation_id = v_variation
    for update;
    if not found then
      -- Cancelado antes de qualquer baixa: registra para não baixar depois.
      insert into public.ml_order_items (user_id, order_id, ml_item_id, ml_variation_id, quantity, status, order_status)
      values (p_user_id, p_order_id, p_item_id, v_variation, p_quantity, 'not_applied', p_order_status)
      on conflict do nothing;
      return jsonb_build_object('result', 'not_applied');
    end if;
    if v_row.status <> 'applied' then
      return jsonb_build_object('result', 'already_' || v_row.status);
    end if;
    v_movement := public.apply_stock_movement(p_user_id, v_row.product_id, v_row.variant_id, 'entrada', v_row.quantity,
      'Venda cancelada no Mercado Livre', 'mercado_livre', v_ref, true);
    update public.ml_order_items set status = 'cancelled', cancel_movement_id = v_movement.id, order_status = p_order_status where id = v_row.id;
    return jsonb_build_object('result', 'cancelled', 'movement_id', v_movement.id, 'product_id', v_row.product_id, 'variant_id', v_row.variant_id);
  end if;

  -- Venda: reserva a chave antes de mexer no estoque (duas execuções ao mesmo tempo não baixam duas vezes).
  insert into public.ml_order_items (user_id, order_id, ml_item_id, ml_variation_id, quantity, product_id, variant_id, status, order_status)
  values (
    p_user_id, p_order_id, p_item_id, v_variation, p_quantity, v_listing.product_id, v_listing.variant_id,
    case when p_is_full then 'skipped_full' when v_listing.id is null then 'unlinked' else 'applied' end,
    p_order_status
  )
  on conflict (user_id, order_id, ml_item_id, ml_variation_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('result', 'already_processed');
  end if;
  if v_row.status <> 'applied' then
    return jsonb_build_object('result', v_row.status);
  end if;

  -- A venda já aconteceu: aceita saldo negativo (o usuário vê e corrige).
  v_movement := public.apply_stock_movement(p_user_id, v_row.product_id, v_row.variant_id, 'venda', p_quantity,
    'Venda no Mercado Livre', 'mercado_livre', v_ref, true);
  update public.ml_order_items set sale_movement_id = v_movement.id where id = v_row.id;
  return jsonb_build_object('result', 'applied', 'movement_id', v_movement.id, 'product_id', v_row.product_id, 'variant_id', v_row.variant_id,
    'balance_after', v_movement.balance_after);
end;
$$;

revoke execute on function public.apply_ml_order_item(uuid, bigint, text, bigint, int, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_ml_order_item(uuid, bigint, text, bigint, int, text, boolean) to service_role;

-- -----------------------------------------------------------------------------
-- Modo automático: movimentação de produto vinculado entra na fila de envio
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_stock_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.ml_connections c
    where c.user_id = new.user_id and c.sync_mode = 'automatic' and c.status = 'active'
  ) and exists (
    select 1 from public.ml_listings l
    where l.user_id = new.user_id and l.link_status = 'linked' and not l.is_full
      and l.product_id = new.product_id and l.variant_id is not distinct from new.variant_id
  ) then
    insert into public.ml_events (user_id, source, topic, resource, payload)
    values (new.user_id, 'system', 'stock_push', 'stock:' || new.product_id || ':' || coalesce(new.variant_id::text, '0'),
            jsonb_build_object('product_id', new.product_id, 'variant_id', new.variant_id))
    on conflict (topic, resource, user_id) where status = 'pending' do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function public.enqueue_stock_push() from public, anon, authenticated;

create trigger stock_movements_enqueue_push after insert on public.stock_movements
for each row execute function public.enqueue_stock_push();

-- Modo seguro: o usuário escolhe manual ou automático.
create or replace function public.set_ml_sync_mode(p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mode not in ('manual', 'automatic') then
    raise exception 'Modo inválido' using errcode = '22023';
  end if;
  update public.ml_connections set sync_mode = p_mode where user_id = (select auth.uid());
  if not found then
    raise exception 'Conecte sua conta do Mercado Livre primeiro' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.set_ml_sync_mode(text) from public, anon;
grant execute on function public.set_ml_sync_mode(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Conferência: estoque do sistema x Mercado Livre (anúncios vinculados, fora do Full)
-- -----------------------------------------------------------------------------
create view public.ml_stock_divergences
with (security_invoker = true)
as
select
  l.id as listing_id,
  l.user_id,
  l.ml_item_id,
  l.ml_variation_id,
  l.title,
  l.variation_label,
  l.permalink,
  l.product_id,
  l.variant_id,
  s.product_name,
  s.variant_name,
  s.sku,
  greatest(s.current_stock, 0) as local_quantity,
  l.ml_available_quantity as ml_quantity,
  l.ml_checked_at
from public.ml_listings l
join public.stock_items s on s.product_id = l.product_id and s.variant_id is not distinct from l.variant_id
where l.link_status = 'linked'
  and not l.is_full
  and coalesce(l.status, 'active') <> 'closed'
  and l.ml_available_quantity is not null
  and l.ml_available_quantity <> greatest(s.current_stock, 0);

-- "Usar o número do Mercado Livre": ajusta o estoque do sistema para a quantidade do anúncio.
create or replace function public.accept_ml_quantity(p_listing_id uuid)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.ml_listings;
  v_row public.stock_movements;
begin
  select * into v_listing from public.ml_listings where id = p_listing_id and user_id = (select auth.uid()) and link_status = 'linked';
  if not found or v_listing.ml_available_quantity is null then
    raise exception 'Anúncio não encontrado ou sem quantidade conferida' using errcode = 'P0002';
  end if;
  v_row := public.apply_stock_movement(v_listing.user_id, v_listing.product_id, v_listing.variant_id, 'ajuste', v_listing.ml_available_quantity,
    'Ajuste pela quantidade do Mercado Livre', 'mercado_livre', v_listing.ml_item_id, false);
  if v_row.id is null then
    raise exception 'O estoque já está igual ao do Mercado Livre' using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.accept_ml_quantity(uuid) from public, anon;
grant execute on function public.accept_ml_quantity(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.ml_events enable row level security;
alter table public.ml_order_items enable row level security;

revoke all on public.ml_events, public.ml_order_items, public.ml_stock_divergences from anon;
revoke insert, update, delete, truncate on public.ml_events, public.ml_order_items from authenticated;

create policy "ml_events: dono lê" on public.ml_events for select to authenticated using (user_id = (select auth.uid()));
create policy "ml_order_items: dono lê" on public.ml_order_items for select to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Agendamentos
-- -----------------------------------------------------------------------------
select cron.schedule('ml-process-events', '* * * * *', $$select public.invoke_edge_function('ml-process-events')$$);
select cron.schedule('ml-reconcile', '7 * * * *', $$select public.invoke_edge_function('ml-reconcile')$$);
-- Guarda a fila por 30 dias.
select cron.schedule('ml-events-cleanup', '23 4 * * *',
  $$delete from public.ml_events where status in ('processed', 'ignored') and created_at < now() - interval '30 days'$$);
