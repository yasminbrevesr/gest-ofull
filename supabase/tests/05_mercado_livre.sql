-- Etapa 5: conexão, anúncios e vínculo com o estoque
select set_config('t.m1', tests.create_user('m1@teste.com')::text, false);
select set_config('t.m2', tests.create_user('m2@teste.com')::text, false);

-- Dados criados pelas Edge Functions (service_role)
insert into public.ml_connections (user_id, seller_id, nickname, access_token_enc, refresh_token_enc, token_expires_at)
values (current_setting('t.m1')::uuid, 123456, 'LOJA_ANA', 'v1:iv:cifrado', 'v1:iv:cifrado', now() + interval '6 hours');

select tests.login(current_setting('t.m1')::uuid);
set role authenticated;
insert into public.products (name, sku) values ('Caneca', 'CANECA-01');
insert into public.products (name, sku) values ('Camiseta', 'CAM');
insert into public.product_variants (product_id, name, sku) select id, 'Azul / M', 'CAM-AZ-M' from public.products where sku = 'CAM';
reset role;

insert into public.ml_listings (user_id, ml_item_id, ml_variation_id, title, seller_sku, status) values
  (current_setting('t.m1')::uuid, 'MLB100', 0, 'Caneca branca', ' caneca-01 ', 'active'),
  (current_setting('t.m1')::uuid, 'MLB200', 555, 'Camiseta', 'CAM-AZ-M', 'active'),
  (current_setting('t.m1')::uuid, 'MLB300', 0, 'Sem SKU', null, 'active'),
  (current_setting('t.m1')::uuid, 'MLB400', 0, 'SKU inexistente', 'NAO-EXISTE', 'active');

select tests.assert(public.suggest_ml_links(current_setting('t.m1')::uuid) = 2, 'sugere vínculo pelo SKU (sem diferenciar maiúsculas/espaços)');
select tests.assert(
  (select variant_id is not null and link_status = 'suggested' from public.ml_listings where ml_item_id = 'MLB200'),
  'sugestão aponta para a variação certa');

select tests.login(current_setting('t.m1')::uuid);
set role authenticated;
select tests.assert_fails($$select * from public.ml_connections$$, 'permission denied', 'app não lê a tabela de tokens');
select tests.assert_fails($$select * from public.ml_oauth_states$$, 'permission denied', 'app não lê os states do OAuth');
select tests.assert((select nickname = 'LOJA_ANA' and status = 'active' and sync_mode = 'manual' from public.get_my_ml_connection()), 'status da conexão sem tokens');
select tests.assert((select count(*) = 4 from public.ml_listings), 'usuário vê os próprios anúncios');

update public.ml_listings set link_status = 'linked' where link_status = 'suggested';
select tests.assert((select count(*) = 2 from public.ml_listings where link_status = 'linked'), 'confirma as sugestões');
update public.ml_listings set product_id = (select id from public.products where sku = 'CANECA-01'), link_status = 'linked' where ml_item_id = 'MLB400';
select tests.assert((select link_status = 'linked' from public.ml_listings where ml_item_id = 'MLB400'), 'vincula manualmente');
select tests.assert_fails($$update public.ml_listings set product_id = (select id from public.products where sku = 'CAM'), variant_id = null where ml_item_id = 'MLB300'$$, 'escolha a variação', 'produto com variações exige a variação');
update public.ml_listings set product_id = null where ml_item_id = 'MLB400';
select tests.assert((select link_status = 'unlinked' and variant_id is null from public.ml_listings where ml_item_id = 'MLB400'), 'desvincular volta para "sem vínculo"');
update public.ml_listings set link_status = 'ignored' where ml_item_id = 'MLB300';
select tests.assert((select link_status = 'ignored' from public.ml_listings where ml_item_id = 'MLB300'), 'ignora anúncio');
select tests.assert_fails($$update public.ml_listings set title = 'hack'$$, 'permission denied', 'não altera dados vindos do Mercado Livre');
select tests.assert_fails($$insert into public.sync_logs (user_id, kind, status, message) values (auth.uid(), 'x', 'info', 'x')$$, 'permission denied', 'não grava log de sincronização');
select tests.assert(public.suggest_my_ml_links() = 0, 'atualizar sugestões não mexe em vínculos existentes');
reset role;

-- Outro usuário não vê nem consegue vincular ao produto de outra pessoa
select tests.login(current_setting('t.m2')::uuid);
set role authenticated;
select tests.assert((select count(*) = 0 from public.ml_listings), 'outro usuário não vê os anúncios');
select tests.assert((select count(*) = 0 from public.get_my_ml_connection()), 'outro usuário não tem conexão');
reset role;
insert into public.ml_listings (user_id, ml_item_id, title) values (current_setting('t.m2')::uuid, 'MLB900', 'Outro');
select set_config('t.caneca_m1', (select id::text from public.products where sku = 'CANECA-01' and user_id = current_setting('t.m1')::uuid), false);
select tests.login(current_setting('t.m2')::uuid);
set role authenticated;
select tests.assert_fails(
  format($$update public.ml_listings set product_id = %L where ml_item_id = 'MLB900'$$, current_setting('t.caneca_m1')),
  'Produto não encontrado', 'não vincula a produto de outro usuário');
reset role;

-- Uma conta do Mercado Livre só pode ficar ligada a um usuário
select tests.assert_fails(
  format($$insert into public.ml_connections (user_id, seller_id, access_token_enc, refresh_token_enc, token_expires_at) values (%L, 123456, 'x', 'x', now())$$, current_setting('t.m2')),
  'ml_connections_seller_id_key', 'mesma conta do ML não conecta em dois usuários');

-- Agendamentos
select tests.assert((select count(*) = 1 from cron.job where jobname = 'ml-refresh-tokens'), 'renovação de tokens agendada');
select tests.assert(public.invoke_edge_function('ml-refresh-tokens') is null, 'sem segredos no Vault o agendamento não faz nada');
select vault.create_secret('https://exemplo.supabase.co', 'project_url');
select vault.create_secret('segredo-teste', 'cron_secret');
select public.invoke_edge_function('ml-refresh-tokens');
select tests.assert(
  (select url = 'https://exemplo.supabase.co/functions/v1/ml-refresh-tokens' and headers ->> 'x-cron-secret' = 'segredo-teste' from net.requests order by id desc limit 1),
  'agendamento chama a função com o segredo');

-- Apagar produto ou variação vinculados desfaz o vínculo (sem travar a exclusão)
select tests.login(current_setting('t.m1')::uuid);
set role authenticated;
update public.ml_listings set product_id = (select id from public.products where sku = 'CANECA-01'), link_status = 'linked' where ml_item_id = 'MLB400';
delete from public.product_variants where sku = 'CAM-AZ-M';
select tests.assert((select link_status = 'unlinked' and product_id is null from public.ml_listings where ml_item_id = 'MLB200'), 'apagar variação desvincula o anúncio');
delete from public.products where sku = 'CANECA-01';
select tests.assert((select count(*) = 0 from public.ml_listings where product_id is not null), 'apagar produto desvincula os anúncios');
select tests.assert((select link_status = 'unlinked' from public.ml_listings where ml_item_id = 'MLB400'), 'anúncio volta para "sem vínculo"');
reset role;
