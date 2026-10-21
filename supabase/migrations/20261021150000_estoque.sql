-- =============================================================================
-- Etapa 4: controle de estoque
-- - products / product_variants: cadastro (SKU único por usuário, entre
--   produtos e variações)
-- - stock_movements: histórico. O saldo (current_stock) é SEMPRE consequência
--   das movimentações: o usuário não consegue editar o saldo direto; ele muda
--   só pela função register_stock_movement (ou pelas rotinas do sistema).
-- - stock_items: visão única de "itens com estoque" (produto simples ou variação)
-- - bucket product-photos: fotos, cada usuário na própria pasta
-- =============================================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  sku text not null check (char_length(sku) between 1 and 60 and sku = btrim(sku)),
  photo_path text,
  cost numeric(12, 2) check (cost >= 0),
  sale_price numeric(12, 2) check (sale_price >= 0),
  -- Saldo: produto simples = próprio saldo; com variações = soma das variações.
  current_stock int not null default 0,
  min_stock int not null default 0 check (min_stock >= 0),
  weight_g int check (weight_g >= 0),
  length_cm numeric(8, 1) check (length_cm >= 0),
  width_cm numeric(8, 1) check (width_cm >= 0),
  height_cm numeric(8, 1) check (height_cm >= 0),
  notes text check (char_length(notes) <= 2000),
  -- Mantido automaticamente quando variações são criadas/apagadas.
  has_variants boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_user_sku_key on public.products (user_id, lower(sku));
create index products_user_name_idx on public.products (user_id, name);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- Ex.: "Azul / M"
  name text not null check (char_length(name) between 1 and 120),
  -- Ex.: {"Cor": "Azul", "Tamanho": "M"}
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  sku text not null check (char_length(sku) between 1 and 60 and sku = btrim(sku)),
  -- Vazio = usa o custo/preço do produto.
  cost numeric(12, 2) check (cost >= 0),
  sale_price numeric(12, 2) check (sale_price >= 0),
  current_stock int not null default 0,
  min_stock int not null default 0 check (min_stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_variants_user_sku_key on public.product_variants (user_id, lower(sku));
create index product_variants_product_idx on public.product_variants (product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  movement_type text not null check (movement_type in ('entrada', 'saida', 'ajuste', 'venda')),
  -- Quantidade com sinal, já aplicada ao saldo (+ entra, - sai).
  quantity int not null check (quantity <> 0),
  balance_after int not null,
  reason text check (char_length(reason) <= 300),
  origin text not null default 'manual' check (origin in ('manual', 'mercado_livre', 'importacao')),
  -- Referência externa (ex.: pedido do Mercado Livre).
  external_ref text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stock_movements_user_idx on public.stock_movements (user_id, created_at desc);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_variant_idx on public.stock_movements (variant_id) where variant_id is not null;

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();

-- Simulações da calculadora podem ser vinculadas a um produto.
alter table public.simulations
  add constraint simulations_product_id_fkey foreign key (product_id) references public.products (id) on delete set null;
create index simulations_product_idx on public.simulations (product_id) where product_id is not null;

-- -----------------------------------------------------------------------------
-- SKU único por usuário somando produtos e variações (é ele que liga o
-- anúncio do Mercado Livre ao estoque).
-- -----------------------------------------------------------------------------
create or replace function public.check_sku_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'products' then
    if exists (select 1 from public.product_variants where user_id = new.user_id and lower(sku) = lower(new.sku)) then
      raise exception 'O SKU % já é usado por uma variação', new.sku using errcode = '23505';
    end if;
  else
    if exists (select 1 from public.products where user_id = new.user_id and lower(sku) = lower(new.sku)) then
      raise exception 'O SKU % já é usado por um produto', new.sku using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_sku_available() from public, anon, authenticated;

create trigger products_check_sku before insert or update of sku on public.products
for each row execute function public.check_sku_available();
create trigger product_variants_check_sku before insert or update of sku on public.product_variants
for each row execute function public.check_sku_available();

-- -----------------------------------------------------------------------------
-- Variações: validações e saldo total do produto
-- -----------------------------------------------------------------------------
create or replace function public.before_variant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
begin
  select * into v_product from public.products where id = new.product_id for update;
  if v_product.user_id is distinct from new.user_id then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;
  if tg_op = 'INSERT' then
    if not v_product.has_variants and v_product.current_stock <> 0 then
      raise exception 'Este produto tem % unidade(s) em estoque. Zere o estoque do produto (ajuste para 0) antes de criar variações.', v_product.current_stock
        using errcode = 'P0001';
    end if;
    -- Variação nasce sem saldo: o estoque inicial entra como movimentação.
    new.current_stock := 0;
  elsif new.product_id <> old.product_id then
    raise exception 'Não é possível mover a variação para outro produto' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.after_variant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set has_variants = exists (select 1 from public.product_variants v where v.product_id = p.id),
      current_stock = coalesce((select sum(v.current_stock) from public.product_variants v where v.product_id = p.id), 0)
  where p.id = v_product_id;
  return null;
end;
$$;

revoke execute on function public.before_variant_change(), public.after_variant_change() from public, anon, authenticated;

create trigger product_variants_before_change before insert or update on public.product_variants
for each row execute function public.before_variant_change();
create trigger product_variants_after_change after insert or delete on public.product_variants
for each row execute function public.after_variant_change();

-- -----------------------------------------------------------------------------
-- Movimentação de estoque (única forma de alterar o saldo)
--   entrada/saida/venda: p_quantity > 0 (a função aplica o sinal)
--   ajuste: p_quantity = estoque contado (novo saldo)
-- Retorna null quando o ajuste não muda nada.
-- -----------------------------------------------------------------------------
create or replace function public.apply_stock_movement(
  p_user_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_type text,
  p_quantity int,
  p_reason text,
  p_origin text,
  p_external_ref text,
  p_allow_negative boolean default false
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_variant public.product_variants;
  v_current int;
  v_delta int;
  v_balance int;
  v_row public.stock_movements;
begin
  -- Trava o produto e depois a variação (sempre nessa ordem) para evitar
  -- dois saldos calculados ao mesmo tempo.
  select * into v_product from public.products where id = p_product_id and user_id = p_user_id for update;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'P0002';
  end if;

  if p_variant_id is not null then
    select * into v_variant from public.product_variants where id = p_variant_id and product_id = p_product_id for update;
    if not found then
      raise exception 'Variação não encontrada' using errcode = 'P0002';
    end if;
    v_current := v_variant.current_stock;
  else
    if v_product.has_variants then
      raise exception 'Este produto tem variações: escolha qual variação movimentar' using errcode = 'P0001';
    end if;
    v_current := v_product.current_stock;
  end if;

  if p_quantity is null then
    raise exception 'Informe a quantidade' using errcode = '22023';
  end if;

  case p_type
    when 'entrada' then
      if p_quantity <= 0 then raise exception 'A quantidade precisa ser maior que zero' using errcode = '22023'; end if;
      v_delta := p_quantity;
    when 'saida', 'venda' then
      if p_quantity <= 0 then raise exception 'A quantidade precisa ser maior que zero' using errcode = '22023'; end if;
      v_delta := -p_quantity;
    when 'ajuste' then
      if p_quantity < 0 then raise exception 'O estoque contado não pode ser negativo' using errcode = '22023'; end if;
      v_delta := p_quantity - v_current;
      if v_delta = 0 then
        return null;
      end if;
    else
      raise exception 'Tipo de movimentação inválido: %', p_type using errcode = '22023';
  end case;

  v_balance := v_current + v_delta;
  if v_balance < 0 and not p_allow_negative then
    raise exception 'Estoque insuficiente: há % unidade(s) disponível(is)', v_current using errcode = 'P0001';
  end if;

  if p_variant_id is not null then
    update public.product_variants set current_stock = v_balance where id = p_variant_id;
    update public.products set current_stock = current_stock + v_delta where id = p_product_id;
  else
    update public.products set current_stock = v_balance where id = p_product_id;
  end if;

  insert into public.stock_movements (user_id, product_id, variant_id, movement_type, quantity, balance_after, reason, origin, external_ref, created_by)
  values (p_user_id, p_product_id, p_variant_id, p_type, v_delta, v_balance, nullif(btrim(p_reason), ''), p_origin, p_external_ref, auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Só o próprio banco e as Edge Functions (service_role) usam a versão completa.
revoke execute on function public.apply_stock_movement(uuid, uuid, uuid, text, int, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_stock_movement(uuid, uuid, uuid, text, int, text, text, text, boolean) to service_role;

-- Versão usada pelo app (usuário logado, origem manual).
create or replace function public.register_stock_movement(
  p_product_id uuid,
  p_variant_id uuid,
  p_type text,
  p_quantity int,
  p_reason text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.stock_movements;
begin
  if auth.uid() is null then
    raise exception 'Faça login novamente' using errcode = '28000';
  end if;
  v_row := public.apply_stock_movement(auth.uid(), p_product_id, p_variant_id, p_type, p_quantity, p_reason, 'manual', null, false);
  if v_row.id is null then
    raise exception 'O estoque já está em % unidade(s)', p_quantity using errcode = 'P0001';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.register_stock_movement(uuid, uuid, text, int, text) from public, anon;
grant execute on function public.register_stock_movement(uuid, uuid, text, int, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Itens com estoque: produtos sem variação + variações (para alertas e vínculo
-- com anúncios do Mercado Livre)
-- -----------------------------------------------------------------------------
create view public.stock_items
with (security_invoker = true)
as
select
  p.user_id,
  p.id as product_id,
  null::uuid as variant_id,
  p.name as product_name,
  null::text as variant_name,
  p.sku,
  p.current_stock,
  p.min_stock,
  p.cost,
  p.sale_price,
  p.photo_path,
  p.archived_at,
  p.current_stock <= p.min_stock as is_low
from public.products p
where not p.has_variants
union all
select
  v.user_id,
  v.product_id,
  v.id,
  p.name,
  v.name,
  v.sku,
  v.current_stock,
  v.min_stock,
  coalesce(v.cost, p.cost),
  coalesce(v.sale_price, p.sale_price),
  p.photo_path,
  p.archived_at,
  v.current_stock <= v.min_stock
from public.product_variants v
join public.products p on p.id = v.product_id;

-- -----------------------------------------------------------------------------
-- RLS e permissões
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.stock_movements enable row level security;

revoke all on public.products, public.product_variants, public.stock_movements, public.stock_items from anon;

create policy "products: dono lê" on public.products for select to authenticated using (user_id = (select auth.uid()));
create policy "products: dono cria" on public.products for insert to authenticated with check (user_id = (select auth.uid()));
create policy "products: dono altera" on public.products for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "products: dono apaga" on public.products for delete to authenticated using (user_id = (select auth.uid()));

create policy "variants: dono lê" on public.product_variants for select to authenticated using (user_id = (select auth.uid()));
create policy "variants: dono cria" on public.product_variants for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid())));
create policy "variants: dono altera" on public.product_variants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "variants: dono apaga" on public.product_variants for delete to authenticated using (user_id = (select auth.uid()));

-- Histórico: só leitura. Movimentações entram pela função register_stock_movement.
create policy "movements: dono lê" on public.stock_movements for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.stock_movements from authenticated;

-- Saldo e has_variants não podem ser escritos pelo usuário.
revoke insert, update on public.products from authenticated;
grant insert (user_id, name, sku, photo_path, cost, sale_price, min_stock, weight_g, length_cm, width_cm, height_cm, notes, archived_at)
  on public.products to authenticated;
grant update (name, sku, photo_path, cost, sale_price, min_stock, weight_g, length_cm, width_cm, height_cm, notes, archived_at)
  on public.products to authenticated;

revoke insert, update on public.product_variants from authenticated;
grant insert (user_id, product_id, name, attributes, sku, cost, sale_price, min_stock) on public.product_variants to authenticated;
grant update (name, attributes, sku, cost, sale_price, min_stock) on public.product_variants to authenticated;

-- -----------------------------------------------------------------------------
-- Fotos dos produtos (bucket privado; caminho: <user_id>/<arquivo>)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "product-photos: dono lê" on storage.objects for select to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-photos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-photos: dono altera" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "product-photos: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- Importação de planilha (CSV já lido e validado no navegador)
-- Cada linha: {line, sku, name, parent_sku, variant_name, cost, sale_price,
--              stock, min_stock, weight_g, length_cm, width_cm, height_cm, notes}
-- - parent_sku preenchido = linha de variação do produto parent_sku
-- - campo vazio (null) = mantém o valor atual
-- - stock = estoque contado: gera um ajuste com origem "importacao"
-- Uma linha com erro não impede as demais. Retorna o resultado de cada linha.
-- -----------------------------------------------------------------------------
create or replace function public.import_products(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_index int := 0;
  v_line int;
  v_results jsonb := '[]'::jsonb;
  v_product public.products;
  v_variant public.product_variants;
  v_status text;
  v_sku text;
  v_parent_sku text;
  v_name text;
  v_variant_name text;
  v_stock int;
begin
  if v_uid is null then
    raise exception 'Faça login novamente' using errcode = '28000';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Formato inválido' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Envie no máximo 2.000 linhas por vez' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_line := coalesce((v_row ->> 'line')::int, v_index);
    v_sku := nullif(btrim(v_row ->> 'sku'), '');
    begin
      v_parent_sku := nullif(btrim(v_row ->> 'parent_sku'), '');
      v_name := nullif(btrim(v_row ->> 'name'), '');
      v_variant_name := nullif(btrim(v_row ->> 'variant_name'), '');
      v_stock := (v_row ->> 'stock')::int;
      if v_sku is null then
        raise exception 'SKU vazio';
      end if;

      if v_parent_sku is not null then
        -- Linha de variação: garante o produto "pai".
        select * into v_product from public.products where user_id = v_uid and lower(sku) = lower(v_parent_sku);
        if not found then
          if v_name is null then
            raise exception 'Informe o nome do produto % (coluna nome)', v_parent_sku;
          end if;
          insert into public.products (user_id, name, sku, weight_g, length_cm, width_cm, height_cm, notes)
          values (v_uid, v_name, v_parent_sku, (v_row ->> 'weight_g')::int, (v_row ->> 'length_cm')::numeric,
                  (v_row ->> 'width_cm')::numeric, (v_row ->> 'height_cm')::numeric, v_row ->> 'notes')
          returning * into v_product;
        else
          update public.products set
            name = coalesce(v_name, name),
            weight_g = coalesce((v_row ->> 'weight_g')::int, weight_g),
            length_cm = coalesce((v_row ->> 'length_cm')::numeric, length_cm),
            width_cm = coalesce((v_row ->> 'width_cm')::numeric, width_cm),
            height_cm = coalesce((v_row ->> 'height_cm')::numeric, height_cm),
            notes = coalesce(v_row ->> 'notes', notes)
          where id = v_product.id
          returning * into v_product;
        end if;

        select * into v_variant from public.product_variants where user_id = v_uid and lower(sku) = lower(v_sku);
        if found then
          if v_variant.product_id <> v_product.id then
            raise exception 'O SKU % já pertence a outro produto', v_sku;
          end if;
          update public.product_variants set
            name = coalesce(v_variant_name, name),
            cost = coalesce((v_row ->> 'cost')::numeric, cost),
            sale_price = coalesce((v_row ->> 'sale_price')::numeric, sale_price),
            min_stock = coalesce((v_row ->> 'min_stock')::int, min_stock)
          where id = v_variant.id
          returning * into v_variant;
          v_status := 'atualizado';
        else
          if v_variant_name is null then
            raise exception 'Informe o nome da variação (coluna variacao)';
          end if;
          insert into public.product_variants (user_id, product_id, name, sku, cost, sale_price, min_stock)
          values (v_uid, v_product.id, v_variant_name, v_sku, (v_row ->> 'cost')::numeric, (v_row ->> 'sale_price')::numeric,
                  coalesce((v_row ->> 'min_stock')::int, 0))
          returning * into v_variant;
          v_status := 'criado';
        end if;

        if v_stock is not null then
          perform public.apply_stock_movement(v_uid, v_product.id, v_variant.id, 'ajuste', v_stock, 'Importação de planilha', 'importacao', null, false);
        end if;
      else
        -- Linha de produto simples.
        select * into v_product from public.products where user_id = v_uid and lower(sku) = lower(v_sku);
        if found then
          update public.products set
            name = coalesce(v_name, name),
            cost = coalesce((v_row ->> 'cost')::numeric, cost),
            sale_price = coalesce((v_row ->> 'sale_price')::numeric, sale_price),
            min_stock = coalesce((v_row ->> 'min_stock')::int, min_stock),
            weight_g = coalesce((v_row ->> 'weight_g')::int, weight_g),
            length_cm = coalesce((v_row ->> 'length_cm')::numeric, length_cm),
            width_cm = coalesce((v_row ->> 'width_cm')::numeric, width_cm),
            height_cm = coalesce((v_row ->> 'height_cm')::numeric, height_cm),
            notes = coalesce(v_row ->> 'notes', notes)
          where id = v_product.id
          returning * into v_product;
          v_status := 'atualizado';
        else
          if v_name is null then
            raise exception 'Informe o nome do produto (coluna nome)';
          end if;
          insert into public.products (user_id, name, sku, cost, sale_price, min_stock, weight_g, length_cm, width_cm, height_cm, notes)
          values (v_uid, v_name, v_sku, (v_row ->> 'cost')::numeric, (v_row ->> 'sale_price')::numeric,
                  coalesce((v_row ->> 'min_stock')::int, 0), (v_row ->> 'weight_g')::int, (v_row ->> 'length_cm')::numeric,
                  (v_row ->> 'width_cm')::numeric, (v_row ->> 'height_cm')::numeric, v_row ->> 'notes')
          returning * into v_product;
          v_status := 'criado';
        end if;

        if v_stock is not null then
          if v_product.has_variants then
            raise exception 'Este produto tem variações: informe o estoque nas linhas de cada variação';
          end if;
          perform public.apply_stock_movement(v_uid, v_product.id, null, 'ajuste', v_stock, 'Importação de planilha', 'importacao', null, false);
        end if;
      end if;

      v_results := v_results || jsonb_build_array(jsonb_build_object('line', v_line, 'sku', v_sku, 'status', v_status));
    exception when others then
      v_results := v_results || jsonb_build_array(jsonb_build_object('line', v_line, 'sku', v_sku, 'status', 'erro', 'message', sqlerrm));
    end;
  end loop;

  return v_results;
end;
$$;

revoke execute on function public.import_products(jsonb) from public, anon;
grant execute on function public.import_products(jsonb) to authenticated;
