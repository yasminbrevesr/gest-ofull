-- Etapa 4: estoque, movimentações, variações, SKU e importação
select set_config('t.e1', tests.create_user('e1@teste.com')::text, false);
select set_config('t.e2', tests.create_user('e2@teste.com')::text, false);

select tests.login(current_setting('t.e1')::uuid);
set role authenticated;

insert into public.products (name, sku, cost, sale_price, min_stock) values ('Caneca', 'CANECA-01', 12, 39.9, 3);
select set_config('t.caneca', (select id::text from public.products where sku = 'CANECA-01'), false);

select tests.assert_fails($$insert into public.products (name, sku, current_stock) values ('X', 'X1', 50)$$, 'permission denied', 'não cria produto com saldo direto');
select tests.assert_fails($$update public.products set current_stock = 99$$, 'permission denied', 'não altera o saldo direto');
select tests.assert_fails($$insert into public.products (name, sku) values ('Outra', 'caneca-01')$$, 'products_user_sku_key', 'SKU único por usuário (sem diferenciar maiúsculas)');
select tests.assert_fails(format($$insert into public.stock_movements (user_id, product_id, movement_type, quantity, balance_after) values (%L, %L, 'entrada', 5, 5)$$, current_setting('t.e1'), current_setting('t.caneca')), 'permission denied', 'não grava movimentação direto na tabela');

-- Movimentações
select public.register_stock_movement(current_setting('t.caneca')::uuid, null, 'entrada', 10, 'Compra do fornecedor');
select tests.assert((select current_stock = 10 from public.products where sku = 'CANECA-01'), 'entrada soma ao saldo');
select public.register_stock_movement(current_setting('t.caneca')::uuid, null, 'venda', 3, 'Venda na feira');
select public.register_stock_movement(current_setting('t.caneca')::uuid, null, 'saida', 1, 'Quebrou');
select tests.assert((select current_stock = 6 from public.products where sku = 'CANECA-01'), 'saída e venda subtraem');
select public.register_stock_movement(current_setting('t.caneca')::uuid, null, 'ajuste', 2, 'Contagem');
select tests.assert((select current_stock = 2 from public.products where sku = 'CANECA-01'), 'ajuste define o saldo contado');
select tests.assert((select quantity = -4 and balance_after = 2 from public.stock_movements where movement_type = 'ajuste'), 'ajuste registra a diferença e o saldo final');
select tests.assert_fails(format($$select public.register_stock_movement(%L, null, 'saida', 5)$$, current_setting('t.caneca')), 'Estoque insuficiente', 'não deixa o saldo negativo');
select tests.assert_fails(format($$select public.register_stock_movement(%L, null, 'entrada', -5)$$, current_setting('t.caneca')), 'maior que zero', 'quantidade negativa é recusada');
select tests.assert_fails(format($$select public.register_stock_movement(%L, null, 'ajuste', 2)$$, current_setting('t.caneca')), 'já está em 2', 'ajuste sem mudança avisa');
select tests.assert((select count(*) = 4 and sum(quantity) = 2 from public.stock_movements where product_id = current_setting('t.caneca')::uuid), 'saldo = soma das movimentações');
select tests.assert((select is_low from public.stock_items where sku = 'CANECA-01'), 'estoque 2 com mínimo 3 aparece como baixo');
select tests.assert_fails($$delete from public.stock_movements$$, 'permission denied', 'histórico não pode ser apagado');

-- Variações
insert into public.products (name, sku, sale_price) values ('Camiseta', 'CAM', 59.9);
select set_config('t.cam', (select id::text from public.products where sku = 'CAM'), false);
insert into public.product_variants (product_id, name, sku, attributes) values
  (current_setting('t.cam')::uuid, 'Azul / M', 'CAM-AZ-M', '{"Cor": "Azul", "Tamanho": "M"}'),
  (current_setting('t.cam')::uuid, 'Rosa / P', 'CAM-RS-P', '{"Cor": "Rosa", "Tamanho": "P"}');
select tests.assert((select has_variants from public.products where sku = 'CAM'), 'produto passa a ter variações');
select tests.assert_fails($$insert into public.product_variants (product_id, name, sku) select id, 'X', 'caneca-01' from public.products where sku = 'CAM'$$, 'já é usado por um produto', 'SKU de variação não repete SKU de produto');
select tests.assert_fails($$insert into public.products (name, sku) values ('Y', 'CAM-AZ-M')$$, 'já é usado por uma variação', 'SKU de produto não repete SKU de variação');
select tests.assert_fails(format($$select public.register_stock_movement(%L, null, 'entrada', 1)$$, current_setting('t.cam')), 'escolha qual variação', 'produto com variações exige a variação');
select public.register_stock_movement(current_setting('t.cam')::uuid, (select id from public.product_variants where sku = 'CAM-AZ-M'), 'entrada', 4);
select public.register_stock_movement(current_setting('t.cam')::uuid, (select id from public.product_variants where sku = 'CAM-RS-P'), 'entrada', 6);
select tests.assert((select current_stock = 10 from public.products where sku = 'CAM'), 'saldo do produto = soma das variações');
select tests.assert((select count(*) = 3 from public.stock_items where user_id = current_setting('t.e1')::uuid), 'stock_items lista produto simples e variações');
select tests.assert_fails(format($$insert into public.product_variants (product_id, name, sku) values (%L, 'P', 'CANECA-P')$$, current_setting('t.caneca')), 'Zere o estoque', 'não cria variação em produto com saldo');
delete from public.product_variants where sku = 'CAM-RS-P';
select tests.assert((select current_stock = 4 from public.products where sku = 'CAM'), 'apagar variação recalcula o total');

-- Importação
select tests.assert(
  (select jsonb_agg(r ->> 'status' order by (r ->> 'line')::int) from jsonb_array_elements(public.import_products($$[
    {"line": 2, "sku": "VELA-01", "name": "Vela aromática", "cost": 8.5, "sale_price": 29.9, "stock": 20, "min_stock": 5},
    {"line": 3, "sku": "CANECA-01", "sale_price": 44.9, "stock": 7},
    {"line": 4, "sku": "KIT-AZ", "parent_sku": "KIT", "name": "Kit toalhas", "variant_name": "Azul", "stock": 3},
    {"line": 5, "sku": "KIT-RS", "parent_sku": "KIT", "variant_name": "Rosa", "stock": 0},
    {"line": 6, "sku": "", "name": "Sem SKU"},
    {"line": 7, "sku": "NOVO-SEM-NOME"},
    {"line": 8, "sku": "CAM", "stock": 3}
  ]$$::jsonb)) r) = '["criado", "atualizado", "criado", "criado", "erro", "erro", "erro"]'::jsonb,
  'importação cria, atualiza e aponta erros linha a linha');
select tests.assert((select current_stock = 20 and cost = 8.5 from public.products where sku = 'VELA-01'), 'importação grava produto novo com estoque');
select tests.assert((select current_stock = 7 and sale_price = 44.9 and cost = 12 from public.products where sku = 'CANECA-01'), 'importação atualiza só o que veio preenchido');
select tests.assert((select current_stock = 3 and has_variants from public.products where sku = 'KIT'), 'importação cria produto com variações');
select tests.assert((select count(*) = 3 from public.stock_movements where origin = 'importacao'), 'estoque importado vira movimentação de origem importação');
reset role;

-- Isolamento entre usuários
select tests.login(current_setting('t.e2')::uuid);
set role authenticated;
select tests.assert((select count(*) = 0 from public.products), 'outro usuário não vê os produtos');
select tests.assert((select count(*) = 0 from public.stock_movements), 'outro usuário não vê o histórico');
select tests.assert((select count(*) = 0 from public.stock_items), 'outro usuário não vê os itens');
select tests.assert_fails(format($$select public.register_stock_movement(%L, null, 'entrada', 1)$$, current_setting('t.caneca')), 'Produto não encontrado', 'não movimenta produto de outro usuário');
select tests.assert_fails(format($$insert into public.product_variants (product_id, name, sku) values (%L, 'Hack', 'HACK')$$, current_setting('t.cam')), 'Produto não encontrado', 'não cria variação em produto de outro usuário');
insert into public.products (name, sku) values ('Caneca', 'CANECA-01');
select tests.assert((select count(*) = 1 from public.products), 'mesmo SKU pode existir em usuários diferentes');
select tests.assert_fails($$select public.apply_stock_movement(auth.uid(), gen_random_uuid(), null, 'entrada', 1, null, 'manual', null, true)$$, 'permission denied', 'função interna não é exposta ao app');
reset role;

-- Fotos: cada um na própria pasta
select tests.login(current_setting('t.e1')::uuid);
set role authenticated;
insert into storage.objects (bucket_id, name) values ('product-photos', current_setting('t.e1') || '/foto.jpg');
select tests.assert_fails(format($$insert into storage.objects (bucket_id, name) values ('product-photos', %L)$$, current_setting('t.e2') || '/foto.jpg'), 'row-level security', 'não envia foto na pasta de outro usuário');
reset role;
