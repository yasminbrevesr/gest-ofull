-- Etapa 3: jornada, progresso por usuário e glossário
select set_config('t.j1', tests.create_user('j1@teste.com')::text, false);
select set_config('t.j2', tests.create_user('j2@teste.com')::text, false);

select tests.assert((select count(*) = 9 from public.guide_steps), '9 etapas da jornada');
select tests.assert((select count(*) = 9 from public.guide_steps where content like '%##%' and jsonb_array_length(links) > 0), 'todas as etapas têm conteúdo e links');
select tests.assert((select count(*) >= 25 from public.glossary_terms), 'glossário com termos iniciais');

-- Etapa não publicada fica escondida para usuários comuns
update public.guide_steps set published = false where slug = 'pos-venda';

select tests.login(current_setting('t.j1')::uuid);
set role authenticated;
select tests.assert((select count(*) = 8 from public.guide_steps), 'usuário só vê etapas publicadas');
insert into public.user_guide_progress (step_id) select id from public.guide_steps where slug in ('criar-conta', 'formalizacao');
select tests.assert((select count(*) = 2 from public.user_guide_progress), 'usuário marca etapas como concluídas');
delete from public.user_guide_progress where step_id = (select id from public.guide_steps where slug = 'formalizacao');
select tests.assert((select count(*) = 1 from public.user_guide_progress), 'usuário desmarca etapa');
select tests.assert_fails($$insert into public.user_guide_progress (step_id) select id from public.guide_steps where slug = 'criar-conta'$$, 'duplicate key', 'não marca a mesma etapa duas vezes');
update public.guide_steps set title = 'hack';
select tests.assert((select count(*) = 0 from public.guide_steps where title = 'hack'), 'usuário comum não edita a jornada');
select tests.assert_fails($$insert into public.glossary_terms (slug, term, short_definition) values ('x', 'x', 'x')$$, 'row-level security', 'usuário comum não edita o glossário');
reset role;

select tests.login(current_setting('t.j2')::uuid);
set role authenticated;
select tests.assert((select count(*) = 0 from public.user_guide_progress), 'progresso de outro usuário é invisível');
reset role;

update public.guide_steps set published = true where slug = 'pos-venda';
