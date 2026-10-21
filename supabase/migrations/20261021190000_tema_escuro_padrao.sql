-- Novo visual: o tema escuro passa a ser o padrão para quem ainda não escolheu.
-- Perfis existentes mantêm o tema salvo.
alter table public.profiles alter column theme set default 'dark';
