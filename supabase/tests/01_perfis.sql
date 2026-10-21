-- Etapa 1: perfis, aceite dos termos e RLS
select set_config('t.a', tests.create_user('ana@teste.com', '{"full_name": "Ana Souza", "terms_version": "2026-10-21"}')::text, false);
select set_config('t.b', tests.create_user('bia@teste.com', '{"name": "Bia (Google)"}')::text, false);

select tests.assert((select count(*) = 2 from public.profiles), 'perfil criado automaticamente no cadastro');
select tests.assert(
  (select terms_accepted_at is not null and terms_version = '2026-10-21' and full_name = 'Ana Souza'
   from public.profiles where user_id = current_setting('t.a')::uuid),
  'aceite dos termos gravado no cadastro com e-mail'
);
select tests.assert(
  (select terms_accepted_at is null and full_name = 'Bia (Google)' from public.profiles where user_id = current_setting('t.b')::uuid),
  'cadastro sem aceite (ex.: Google) fica pendente'
);

-- Usuária A logada
select tests.login(current_setting('t.a')::uuid);
set role authenticated;

select tests.assert((select count(*) = 1 from public.profiles), 'usuário só enxerga o próprio perfil');
select tests.assert(not public.is_admin(), 'usuário comum não é admin');

update public.profiles set full_name = 'Ana S.', default_tax_rate = 4, theme = 'dark' where user_id = current_setting('t.a')::uuid;
select tests.assert((select full_name = 'Ana S.' and theme = 'dark' from public.profiles), 'edita o próprio perfil');

update public.profiles set full_name = 'invasão' where user_id = current_setting('t.b')::uuid;
select tests.assert_fails($$update public.profiles set role = 'admin'$$, 'permission denied', 'não consegue se promover a admin');
select tests.assert_fails($$insert into public.profiles (user_id) values (gen_random_uuid())$$, 'permission denied', 'não cria perfil manualmente');
select tests.assert_fails($$delete from public.profiles$$, 'permission denied', 'não apaga perfil');
select tests.assert_fails($$update public.profiles set default_tax_rate = 150$$, 'check', 'alíquota acima de 100% é recusada');

reset role;
select tests.assert(
  (select full_name = 'Bia (Google)' from public.profiles where user_id = current_setting('t.b')::uuid),
  'não altera o perfil de outro usuário'
);

-- Visitante sem login
select set_config('request.jwt.claims', '', false);
set role anon;
select tests.assert_fails($$select * from public.profiles$$, 'permission denied', 'visitante não lê perfis');
reset role;

-- Admin
update public.profiles set role = 'admin' where user_id = current_setting('t.a')::uuid;
select tests.login(current_setting('t.a')::uuid);
set role authenticated;
select tests.assert(public.is_admin(), 'admin reconhecido por is_admin()');
reset role;
