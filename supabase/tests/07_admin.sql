-- Etapa 7: funções da área administrativa
select set_config('t.a1', tests.create_user('admin7@teste.com', '{"full_name": "Admin"}')::text, false);
select set_config('t.u7', tests.create_user('user7@teste.com', '{"full_name": "Usuária"}')::text, false);
update public.profiles set role = 'admin' where user_id = current_setting('t.a1')::uuid;
insert into public.ml_connections (user_id, seller_id, nickname, access_token_enc, refresh_token_enc, token_expires_at)
values (current_setting('t.u7')::uuid, 7007, 'LOJA7', 'segredo-cifrado', 'segredo-cifrado', now());

-- Usuário comum não acessa
select tests.login(current_setting('t.u7')::uuid);
set role authenticated;
select tests.assert_fails($$select * from public.admin_list_users()$$, 'restrito a administradores', 'usuário comum não lista usuários');
select tests.assert_fails($$select public.admin_replace_fee_rule('{"rule_type": "fixed_fee", "amount": 1}')$$, 'restrito a administradores', 'usuário comum não altera tarifas');
select tests.assert_fails($$select public.admin_reorder_guide_steps(array[]::uuid[])$$, 'restrito a administradores', 'usuário comum não reordena a jornada');
reset role;

-- Admin
select tests.login(current_setting('t.a1')::uuid);
set role authenticated;
select tests.assert((select count(*) >= 2 from public.admin_list_users()), 'admin lista os usuários');
select tests.assert((select ml_nickname = 'LOJA7' and ml_status = 'active' from public.admin_list_users() where email = 'user7@teste.com'), 'lista mostra o status da conexão');
select tests.assert(
  (select count(*) = 0 from information_schema.routines r
   where r.routine_name = 'admin_list_users' and pg_get_function_result((select oid from pg_proc where proname = 'admin_list_users')) like '%token%'),
  'lista não tem colunas de token');

-- Troca de comissão com vigência
select set_config('t.cat', (select id::text from public.categories where name = 'Ferramentas'), false);
select public.admin_replace_fee_rule(jsonb_build_object('rule_type', 'commission', 'category_id', current_setting('t.cat'), 'listing_type', 'classico', 'percent', 12.5, 'valid_from', '2026-11-01'));
select tests.assert(
  (select valid_to = '2026-10-31' from public.fee_rules where category_id = current_setting('t.cat')::uuid and listing_type = 'classico' and valid_from = '2026-03-02'),
  'tarifa anterior encerra no dia anterior');
select tests.assert(
  (select percent = 12.5 and valid_to is null from public.fee_rules where category_id = current_setting('t.cat')::uuid and listing_type = 'classico' and valid_from = '2026-11-01'),
  'nova tarifa criada sem fim');
select tests.assert(
  (select valid_to is null from public.fee_rules where category_id = current_setting('t.cat')::uuid and listing_type = 'premium'),
  'tarifa do Premium não é afetada');

-- Custo fixo: mesma faixa e formas de envio
select public.admin_replace_fee_rule('{"rule_type": "fixed_fee", "shipping_methods": ["flex", "proprio"], "price_min": 19, "price_max": 49, "amount": 6.95, "valid_from": "2026-12-01"}');
select tests.assert((select count(*) = 1 from public.fee_rules where rule_type = 'fixed_fee' and price_min = 19 and valid_to = '2026-11-30'), 'faixa de custo fixo equivalente é encerrada');
select tests.assert((select count(*) = 2 from public.fee_rules where rule_type = 'fixed_fee' and price_min <> 19 and valid_to is null), 'outras faixas continuam valendo');

select tests.assert_fails(
  format($$select public.admin_replace_fee_rule(jsonb_build_object('rule_type', 'commission', 'category_id', %L, 'listing_type', 'classico', 'percent', 13, 'valid_from', '2026-11-01'))$$, current_setting('t.cat')),
  'Já existe uma regra igual', 'não cria duas regras iguais no mesmo dia');

-- Reordenar jornada
select public.admin_reorder_guide_steps(array(select id from public.guide_steps order by position desc));
select tests.assert((select slug = 'pos-venda' from public.guide_steps order by position limit 1), 'jornada reordenada');
reset role;
