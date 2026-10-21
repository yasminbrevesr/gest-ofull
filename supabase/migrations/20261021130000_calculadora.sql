-- =============================================================================
-- Etapa 2: calculadora de lucro
-- - categories: categorias do Mercado Livre (definem a comissão)
-- - fee_rules: TODAS as tarifas (comissão e custo fixo), com vigência.
--   Nada de valor de tarifa fixo no código: o Mercado Livre muda com frequência.
-- - app_settings: data da última conferência das tarifas, link oficial e
--   limite de margem "saudável"
-- - simulations: simulações salvas pelo usuário
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories (global, editada pelo administrador)
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  description text,
  -- Id da categoria no Mercado Livre (ex.: MLB1051), para a fase 2.
  ml_category_id text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- fee_rules (global, editada pelo administrador)
--   commission: % sobre o preço, por categoria e tipo de anúncio.
--   fixed_fee : valor fixo por unidade numa faixa de preço [price_min, price_max),
--               para as formas de envio listadas. max_percent_of_price limita o
--               valor a uma % do preço (ex.: 50 = "no máximo metade do preço").
--   Campos nulos significam "vale para todos".
-- -----------------------------------------------------------------------------
create table public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type text not null check (rule_type in ('commission', 'fixed_fee')),
  category_id uuid references public.categories (id) on delete cascade,
  listing_type text check (listing_type in ('classico', 'premium')),
  shipping_methods text[] check (
    shipping_methods is null
    or (cardinality(shipping_methods) > 0
        and shipping_methods <@ array['full', 'coleta', 'agencia', 'flex', 'proprio'])
  ),
  price_min numeric(12, 2) check (price_min >= 0),
  price_max numeric(12, 2) check (price_max > 0),
  percent numeric(6, 3) check (percent between 0 and 100),
  amount numeric(12, 2) check (amount >= 0),
  max_percent_of_price numeric(5, 2) check (max_percent_of_price between 0 and 100),
  valid_from date not null default current_date,
  valid_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_rules_valid_period check (valid_to is null or valid_to >= valid_from),
  constraint fee_rules_price_range check (price_min is null or price_max is null or price_max > price_min),
  constraint fee_rules_commission_fields check (
    rule_type <> 'commission' or (category_id is not null and listing_type is not null and percent is not null)
  ),
  constraint fee_rules_fixed_fee_fields check (rule_type <> 'fixed_fee' or amount is not null)
);

comment on table public.fee_rules is 'Tarifas do Mercado Livre com vigência. Valores de referência: conferir na página oficial.';

create index fee_rules_lookup_idx on public.fee_rules (rule_type, valid_from, valid_to);
create index fee_rules_category_idx on public.fee_rules (category_id);

create trigger fee_rules_set_updated_at
before update on public.fee_rules
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- app_settings (linha única)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  -- Data em que o administrador conferiu as tarifas na página oficial.
  fees_reviewed_on date,
  fees_source_url text not null default 'https://www.mercadolivre.com.br/ajuda',
  -- Margem (%) a partir da qual a venda é considerada saudável (verde).
  margin_healthy_pct numeric(5, 2) not null default 15 check (margin_healthy_pct between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1);

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- simulations (do usuário)
-- -----------------------------------------------------------------------------
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- Vínculo com o estoque (chave estrangeira criada na etapa do estoque).
  product_id uuid,
  listing_type text check (listing_type in ('classico', 'premium')),
  shipping_method text check (shipping_method in ('full', 'coleta', 'agencia', 'flex', 'proprio')),
  category_id uuid references public.categories (id) on delete set null,
  sale_price numeric(12, 2),
  net_profit numeric(12, 2),
  margin_pct numeric(8, 2),
  -- Tudo o que foi digitado e o resultado completo, para reabrir a simulação.
  inputs jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index simulations_user_idx on public.simulations (user_id, created_at desc);

create trigger simulations_set_updated_at
before update on public.simulations
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.fee_rules enable row level security;
alter table public.app_settings enable row level security;
alter table public.simulations enable row level security;

revoke all on public.categories, public.fee_rules, public.app_settings, public.simulations from anon;

-- Conteúdo global: qualquer usuário logado lê; só admin altera.
create policy "categories: logados leem" on public.categories for select to authenticated using (true);
create policy "categories: admin altera" on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "fee_rules: logados leem" on public.fee_rules for select to authenticated using (true);
create policy "fee_rules: admin altera" on public.fee_rules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "app_settings: logados leem" on public.app_settings for select to authenticated using (true);
create policy "app_settings: admin altera" on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, delete on public.app_settings from authenticated;

create policy "simulations: dono lê" on public.simulations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "simulations: dono cria" on public.simulations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "simulations: dono altera" on public.simulations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "simulations: dono apaga" on public.simulations for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Dados iniciais (VALORES DE REFERÊNCIA — o administrador deve conferir na
-- página oficial do Mercado Livre e registrar a data em app_settings).
-- Comissões aproximadas por categoria (variam por subcategoria).
-- -----------------------------------------------------------------------------
with seed (sort_order, name, classico, premium) as (
  values
    (10, 'Acessórios para Veículos', 12.0, 17.0),
    (20, 'Alimentos e Bebidas', 14.0, 19.0),
    (30, 'Bebês', 14.0, 19.0),
    (40, 'Beleza e Cuidado Pessoal', 14.0, 19.0),
    (50, 'Brinquedos e Hobbies', 13.0, 18.0),
    (60, 'Calçados, Roupas e Bolsas', 14.0, 19.0),
    (70, 'Casa, Móveis e Decoração', 11.5, 16.5),
    (80, 'Celulares e Telefones', 12.0, 17.0),
    (90, 'Eletrodomésticos', 11.0, 16.0),
    (100, 'Eletrônicos, Áudio e Vídeo', 13.0, 18.0),
    (110, 'Esportes e Fitness', 14.0, 19.0),
    (120, 'Ferramentas', 12.0, 17.0),
    (130, 'Informática', 12.0, 17.0),
    (140, 'Pet Shop', 13.0, 18.0),
    (999, 'Outra categoria / não sei', 14.0, 19.0)
),
inserted as (
  insert into public.categories (name, sort_order, description)
  select name, sort_order,
         case when name like 'Outra%' then 'Usa a maior comissão comum (estimativa conservadora).' end
  from seed
  returning id, name
)
insert into public.fee_rules (rule_type, category_id, listing_type, percent, valid_from, notes)
select 'commission', i.id, t.listing_type, t.percent, date '2026-03-02', 'Referência aproximada da categoria. Confira o % exato ao criar o anúncio.'
from inserted i
join seed s on s.name = i.name
cross join lateral (values ('classico', s.classico), ('premium', s.premium)) as t (listing_type, percent);

-- Custo fixo por unidade abaixo de R$ 79: só Flex e envio próprio.
-- (Desde 02/03/2026 Full, Coleta e Agência pagam custo de envio por peso e
-- preço, informado no campo "custo de envio" da calculadora.)
insert into public.fee_rules (rule_type, shipping_methods, price_min, price_max, amount, max_percent_of_price, valid_from, notes)
values
  ('fixed_fee', array['flex', 'proprio'], 0, 19, 6.25, 50, date '2026-03-02', 'Abaixo de R$ 19: no máximo metade do preço.'),
  ('fixed_fee', array['flex', 'proprio'], 19, 49, 6.65, null, date '2026-03-02', null),
  ('fixed_fee', array['flex', 'proprio'], 49, 79, 7.75, null, date '2026-03-02', null);
