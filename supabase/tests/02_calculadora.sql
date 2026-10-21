-- Etapa 2: tarifas (somente admin altera) e simulações (cada um vê as suas)
select set_config('t.u1', tests.create_user('u1@teste.com')::text, false);
select set_config('t.u2', tests.create_user('u2@teste.com')::text, false);
select set_config('t.adm', tests.create_user('adm@teste.com')::text, false);
update public.profiles set role = 'admin' where user_id = current_setting('t.adm')::uuid;

select tests.assert((select count(*) = 15 from public.categories), '15 categorias de referência');
select tests.assert((select count(*) = 30 from public.fee_rules where rule_type = 'commission'), 'comissão Clássico e Premium para cada categoria');
select tests.assert((select count(*) = 3 from public.fee_rules where rule_type = 'fixed_fee'), '3 faixas de custo fixo');
select tests.assert((select fees_reviewed_on is null from public.app_settings), 'tarifas começam como "não conferidas"');

-- Regras de integridade
select tests.assert_fails($$insert into public.fee_rules (rule_type, listing_type, percent) values ('commission', 'classico', 10)$$, 'fee_rules_commission_fields', 'comissão exige categoria');
select tests.assert_fails($$insert into public.fee_rules (rule_type, amount, shipping_methods) values ('fixed_fee', 5, array['correio'])$$, 'shipping_methods', 'forma de envio inválida é recusada');
select tests.assert_fails($$insert into public.fee_rules (rule_type, amount, valid_from, valid_to) values ('fixed_fee', 5, '2026-05-01', '2026-04-01')$$, 'fee_rules_valid_period', 'vigência com fim antes do início é recusada');

-- Usuário comum
select tests.login(current_setting('t.u1')::uuid);
set role authenticated;
select tests.assert((select count(*) > 0 from public.fee_rules), 'usuário lê as tarifas');
select tests.assert((select count(*) = 1 from public.app_settings), 'usuário lê as configurações');
update public.fee_rules set percent = 1;
select tests.assert((select count(*) = 0 from public.fee_rules where percent = 1), 'usuário comum não altera tarifas');
update public.app_settings set margin_healthy_pct = 1;
select tests.assert((select margin_healthy_pct = 15 from public.app_settings), 'usuário comum não altera configurações');
select tests.assert_fails($$insert into public.categories (name) values ('Hack')$$, 'row-level security', 'usuário comum não cria categoria');

insert into public.simulations (name, inputs, results, sale_price) values ('Camiseta', '{}', '{}', 59.9);
select tests.assert((select count(*) = 1 from public.simulations), 'usuário salva simulação');
select tests.assert_fails(
  format($$insert into public.simulations (user_id, name, inputs, results) values (%L, 'x', '{}', '{}')$$, current_setting('t.u2')),
  'row-level security', 'não salva simulação em nome de outro usuário');
reset role;

select tests.login(current_setting('t.u2')::uuid);
set role authenticated;
select tests.assert((select count(*) = 0 from public.simulations), 'outro usuário não vê a simulação');
delete from public.simulations;
reset role;
select tests.assert((select count(*) = 1 from public.simulations), 'outro usuário não apaga a simulação');

-- Admin
select tests.login(current_setting('t.adm')::uuid);
set role authenticated;
update public.app_settings set fees_reviewed_on = '2026-10-21';
insert into public.categories (name) values ('Nova categoria');
update public.fee_rules set percent = 10.5 where rule_type = 'commission' and listing_type = 'classico'
  and category_id = (select id from public.categories where name = 'Ferramentas');
reset role;
select tests.assert((select fees_reviewed_on = '2026-10-21' from public.app_settings), 'admin registra a conferência das tarifas');
select tests.assert((select count(*) = 16 from public.categories), 'admin cria categoria');
select tests.assert(
  (select percent = 10.5 from public.fee_rules f join public.categories c on c.id = f.category_id where c.name = 'Ferramentas' and listing_type = 'classico'),
  'admin altera tarifa');
