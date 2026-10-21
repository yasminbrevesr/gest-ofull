-- =============================================================================
-- Etapa 7: área administrativa
-- As tabelas de conteúdo e tarifas já aceitam edição pelo admin (RLS com
-- is_admin()). Aqui ficam as funções que precisam de mais de uma operação.
-- =============================================================================

-- Lista de usuários com status da conexão (nunca expõe tokens).
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  person_type text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  onboarding_completed_at timestamptz,
  products_count bigint,
  ml_nickname text,
  ml_status text,
  ml_sync_mode text,
  ml_last_sync_at timestamptz,
  ml_last_sync_status text,
  ml_listings_count bigint,
  ml_events_errors bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    p.person_type,
    p.role,
    u.created_at,
    u.last_sign_in_at,
    p.onboarding_completed_at,
    (select count(*) from public.products pr where pr.user_id = u.id),
    c.nickname,
    c.status,
    c.sync_mode,
    c.last_sync_at,
    c.last_sync_status,
    (select count(*) from public.ml_listings l where l.user_id = u.id),
    (select count(*) from public.ml_events e where e.user_id = u.id and e.status = 'error')
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  left join public.ml_connections c on c.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- Nova tarifa com vigência: encerra a regra equivalente em vigor (no dia
-- anterior ao início da nova) e cria a nova, numa única operação.
create or replace function public.admin_replace_fee_rule(p_rule jsonb)
returns public.fee_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new public.fee_rules;
  v_methods text[];
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  v_methods := case when p_rule ? 'shipping_methods' and jsonb_typeof(p_rule -> 'shipping_methods') = 'array'
                    then array(select jsonb_array_elements_text(p_rule -> 'shipping_methods')) end;

  if exists (
    select 1 from public.fee_rules f
    where f.rule_type = p_rule ->> 'rule_type'
      and f.category_id is not distinct from nullif(p_rule ->> 'category_id', '')::uuid
      and f.listing_type is not distinct from nullif(p_rule ->> 'listing_type', '')
      and f.shipping_methods is not distinct from v_methods
      and f.price_min is not distinct from (p_rule ->> 'price_min')::numeric
      and f.price_max is not distinct from (p_rule ->> 'price_max')::numeric
      and f.valid_from = coalesce((p_rule ->> 'valid_from')::date, current_date)
  ) then
    raise exception 'Já existe uma regra igual começando nesta data. Exclua a anterior no histórico ou escolha outra data.' using errcode = 'P0001';
  end if;

  insert into public.fee_rules (rule_type, category_id, listing_type, shipping_methods, price_min, price_max, percent, amount,
                                max_percent_of_price, valid_from, valid_to, notes)
  values (
    p_rule ->> 'rule_type',
    nullif(p_rule ->> 'category_id', '')::uuid,
    nullif(p_rule ->> 'listing_type', ''),
    v_methods,
    (p_rule ->> 'price_min')::numeric,
    (p_rule ->> 'price_max')::numeric,
    (p_rule ->> 'percent')::numeric,
    (p_rule ->> 'amount')::numeric,
    (p_rule ->> 'max_percent_of_price')::numeric,
    coalesce((p_rule ->> 'valid_from')::date, current_date),
    (p_rule ->> 'valid_to')::date,
    nullif(p_rule ->> 'notes', '')
  )
  returning * into v_new;

  -- Encerra a regra equivalente (mesmo tipo, categoria, anúncio, envio e faixa) ainda aberta.
  update public.fee_rules f
  set valid_to = v_new.valid_from - 1
  where f.id <> v_new.id
    and f.rule_type = v_new.rule_type
    and f.category_id is not distinct from v_new.category_id
    and f.listing_type is not distinct from v_new.listing_type
    and f.shipping_methods is not distinct from v_new.shipping_methods
    and f.price_min is not distinct from v_new.price_min
    and f.price_max is not distinct from v_new.price_max
    and f.valid_from < v_new.valid_from
    and (f.valid_to is null or f.valid_to >= v_new.valid_from);

  return v_new;
end;
$$;

revoke execute on function public.admin_replace_fee_rule(jsonb) from public, anon;
grant execute on function public.admin_replace_fee_rule(jsonb) to authenticated;

-- Reordena as etapas da jornada conforme a lista de ids (10, 20, 30…).
create or replace function public.admin_reorder_guide_steps(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  update public.guide_steps g
  set position = o.ord * 10
  from unnest(p_ids) with ordinality as o (id, ord)
  where g.id = o.id;
end;
$$;

revoke execute on function public.admin_reorder_guide_steps(uuid[]) from public, anon;
grant execute on function public.admin_reorder_guide_steps(uuid[]) to authenticated;
