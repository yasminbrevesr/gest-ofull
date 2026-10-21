-- Etapa 6: fila, vendas idempotentes, envio automático e conferência
select set_config('t.s1', tests.create_user('s1@teste.com')::text, false);
select set_config('t.s2', tests.create_user('s2@teste.com')::text, false);
insert into public.ml_connections (user_id, seller_id, nickname, access_token_enc, refresh_token_enc, token_expires_at)
values (current_setting('t.s1')::uuid, 777, 'LOJA_S1', 'x', 'x', now() + interval '6 hours');

select tests.login(current_setting('t.s1')::uuid);
set role authenticated;
insert into public.products (name, sku) values ('Caneca', 'CAN');
select public.register_stock_movement((select id from public.products where sku = 'CAN'), null, 'entrada', 10);
insert into public.products (name, sku) values ('Vela', 'VELA');
select public.register_stock_movement((select id from public.products where sku = 'VELA'), null, 'entrada', 5);
reset role;
select set_config('t.can', (select id::text from public.products where sku = 'CAN'), false);
select set_config('t.vela', (select id::text from public.products where sku = 'VELA'), false);

insert into public.ml_listings (user_id, ml_item_id, title, product_id, link_status, ml_available_quantity, is_full) values
  (current_setting('t.s1')::uuid, 'MLB1', 'Caneca', current_setting('t.can')::uuid, 'linked', 10, false),
  (current_setting('t.s1')::uuid, 'MLB2', 'Vela Full', current_setting('t.vela')::uuid, 'linked', 30, true),
  (current_setting('t.s1')::uuid, 'MLB3', 'Sem vínculo', null, 'unlinked', 4, false);

-- Fila --------------------------------------------------------------------
select set_config('t.ign', public.enqueue_ml_webhook('orders_v2', '/orders/1', 999, '{}')::text, false);
select tests.assert((select status = 'ignored' from public.ml_events where id = current_setting('t.ign')::uuid), 'notificação de vendedor desconhecido é ignorada');
select set_config('t.ev', public.enqueue_ml_webhook('orders_v2', '/orders/100', 777, '{"attempts": 1}')::text, false);
select tests.assert(public.enqueue_ml_webhook('orders_v2', '/orders/100', 777, '{"attempts": 2}') is null, 'notificação repetida não duplica a fila');
select tests.assert((select count(*) = 1 from public.claim_ml_events(10)), 'worker pega o evento pendente');
select tests.assert((select count(*) = 0 from public.claim_ml_events(10)), 'evento em processamento não é pego de novo');
update public.ml_events set locked_until = now() - interval '1 second' where id = current_setting('t.ev')::uuid;
select tests.assert((select attempts = 2 from public.claim_ml_events(10)), 'evento travado volta para a fila e conta tentativa');

-- Vendas ------------------------------------------------------------------
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 100, 'MLB1', null, 3, 'paid', false) ->> 'result' = 'applied', 'venda baixa o estoque');
select tests.assert((select current_stock = 7 from public.products where sku = 'CAN'), 'estoque 10 - 3 = 7');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 100, 'MLB1', null, 3, 'paid', false) ->> 'result' = 'already_processed', 'mesma venda não baixa duas vezes');
select tests.assert((select current_stock = 7 from public.products where sku = 'CAN'), 'estoque continua 7');
select tests.assert((select origin = 'mercado_livre' and external_ref = 'Pedido 100' and movement_type = 'venda' from public.stock_movements where product_id = current_setting('t.can')::uuid order by created_at desc limit 1), 'movimentação registra origem e pedido');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 100, 'MLB1', null, 3, 'cancelled', false) ->> 'result' = 'cancelled', 'venda cancelada devolve o estoque');
select tests.assert((select current_stock = 10 from public.products where sku = 'CAN'), 'estoque volta para 10');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 100, 'MLB1', null, 3, 'cancelled', false) ->> 'result' = 'already_cancelled', 'cancelamento repetido não devolve duas vezes');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 200, 'MLB2', null, 1, 'paid', true) ->> 'result' = 'skipped_full', 'venda no Full não mexe no estoque local');
select tests.assert((select current_stock = 5 from public.products where sku = 'VELA'), 'estoque da vela intacto');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 300, 'MLB3', null, 1, 'paid', false) ->> 'result' = 'unlinked', 'anúncio sem vínculo é registrado sem baixa');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 400, 'MLB1', null, 1, 'cancelled', false) ->> 'result' = 'not_applied', 'cancelado antes da baixa é registrado');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 400, 'MLB1', null, 1, 'paid', false) ->> 'result' = 'already_processed', 'pedido cancelado não baixa depois');
select tests.assert(public.apply_ml_order_item(current_setting('t.s1')::uuid, 500, 'MLB1', null, 15, 'paid', false) ->> 'result' = 'applied', 'venda maior que o estoque é aceita (já aconteceu)');
select tests.assert((select current_stock = -5 from public.products where sku = 'CAN'), 'saldo fica negativo para o usuário corrigir');
select public.apply_ml_order_item(current_setting('t.s1')::uuid, 500, 'MLB1', null, 15, 'cancelled', false);

-- Envio automático ----------------------------------------------------------
delete from public.ml_events;
select tests.login(current_setting('t.s1')::uuid);
set role authenticated;
select public.register_stock_movement(current_setting('t.can')::uuid, null, 'entrada', 2);
reset role;
select tests.assert((select count(*) = 0 from public.ml_events), 'modo manual: movimentação não envia sozinha');
select tests.login(current_setting('t.s1')::uuid);
set role authenticated;
select public.set_ml_sync_mode('automatic');
select public.register_stock_movement(current_setting('t.can')::uuid, null, 'entrada', 1);
select public.register_stock_movement(current_setting('t.can')::uuid, null, 'saida', 1);
select public.register_stock_movement(current_setting('t.vela')::uuid, null, 'entrada', 1);
reset role;
select tests.assert((select count(*) = 1 and min(topic) = 'stock_push' and min(resource) = 'stock:' || current_setting('t.can') || ':0' from public.ml_events), 'modo automático: uma tarefa de envio por produto (Full não entra)');

-- Conferência -----------------------------------------------------------------
select tests.login(current_setting('t.s1')::uuid);
set role authenticated;
select tests.assert((select local_quantity = 12 and ml_quantity = 10 from public.ml_stock_divergences where ml_item_id = 'MLB1'), 'divergência mostra sistema x Mercado Livre');
select tests.assert((select count(*) = 1 from public.ml_stock_divergences), 'Full e sem vínculo ficam fora da conferência');
select public.accept_ml_quantity((select id from public.ml_listings where ml_item_id = 'MLB1'));
select tests.assert((select current_stock = 10 from public.products where sku = 'CAN'), '"usar número do ML" ajusta o estoque');
select tests.assert((select count(*) = 0 from public.ml_stock_divergences), 'divergência resolvida');

-- Reprocessar e permissões
select tests.assert_fails($$insert into public.ml_events (user_id, source, topic, resource) values (auth.uid(), 'system', 'x', 'y')$$, 'permission denied', 'app não grava na fila');
select tests.assert_fails($$select public.claim_ml_events(1)$$, 'permission denied', 'app não pega eventos da fila');
select tests.assert_fails($$select public.apply_ml_order_item(auth.uid(), 1, 'MLB1', null, 1, 'paid', false)$$, 'permission denied', 'app não baixa venda direto');
reset role;
update public.ml_events set status = 'error', last_error = 'falhou' where topic = 'stock_push';
select tests.login(current_setting('t.s2')::uuid);
set role authenticated;
select tests.assert((select count(*) = 0 from public.ml_events), 'outro usuário não vê a fila');
select tests.assert_fails(format($$select public.retry_ml_event(%L)$$, (select id from public.ml_events limit 1)), 'não encontrado', 'outro usuário não reprocessa');
reset role;
select tests.login(current_setting('t.s1')::uuid);
set role authenticated;
select public.retry_ml_event((select id from public.ml_events where status = 'error' limit 1));
select tests.assert((select status = 'pending' and attempts = 0 from public.ml_events where topic = 'stock_push'), 'reprocessar volta o evento para a fila');
select tests.assert((select count(*) = 5 from public.ml_order_items), 'usuário consulta as vendas processadas');
reset role;
select tests.assert((select count(*) = 3 from cron.job where jobname in ('ml-process-events', 'ml-reconcile', 'ml-events-cleanup')), 'processamento e conferência agendados');
