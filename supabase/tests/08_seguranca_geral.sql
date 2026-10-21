-- Verificações gerais de segurança em todas as tabelas do schema public
select tests.assert(
  (select bool_and(rowsecurity) from pg_tables where schemaname = 'public'),
  'RLS ativo em todas as tabelas: ' || coalesce((select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity), 'ok'));

select tests.assert(
  (select count(*) = 0 from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v') and has_table_privilege('anon', c.oid, 'SELECT')),
  'visitante sem login não lê nenhuma tabela ou visão');

select tests.assert(
  (select bool_and(coalesce(c.reloptions::text like '%security_invoker=true%', false))
   from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v'),
  'visões respeitam o RLS de quem consulta (security_invoker)');

select tests.assert(
  (select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and not exists (
     select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  'funções security definer têm search_path fixo');

select tests.assert(
  (select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname not in ('set_updated_at')),
  'visitante sem login não executa funções: ' || coalesce((select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')), 'nenhuma'));
