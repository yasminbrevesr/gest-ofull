-- =============================================================================
-- Etapa 3: jornada "Como começar a vender" e glossário
-- - guide_steps: etapas da trilha (conteúdo em markdown, editável pelo admin)
-- - user_guide_progress: etapas que cada usuário marcou como concluídas
-- - glossary_terms: termos explicados (usados no glossário e nas dicas)
-- =============================================================================

create table public.guide_steps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position int not null,
  title text not null check (char_length(title) between 1 and 120),
  -- Resumo curto mostrado no cartão da trilha.
  summary text not null check (char_length(summary) <= 300),
  -- Explicação e passo a passo, em markdown.
  content text not null,
  -- Links oficiais: [{"label": "...", "url": "https://..."}]
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  estimated_minutes int check (estimated_minutes > 0),
  -- Resposta do cadastro inicial que indica que a pessoa provavelmente já fez esta etapa.
  onboarding_flag text check (onboarding_flag in ('has_ml_account', 'has_cnpj', 'has_products')),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guide_steps_position_idx on public.guide_steps (position);

create trigger guide_steps_set_updated_at
before update on public.guide_steps
for each row execute function public.set_updated_at();

create table public.user_guide_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step_id uuid not null references public.guide_steps (id) on delete cascade,
  -- created_at = quando a etapa foi marcada como concluída.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

create index user_guide_progress_step_idx on public.user_guide_progress (step_id);

create trigger user_guide_progress_set_updated_at
before update on public.user_guide_progress
for each row execute function public.set_updated_at();

create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  term text not null check (char_length(term) between 1 and 80),
  -- Explicação curta (cabe numa dica "o que é isso?").
  short_definition text not null check (char_length(short_definition) <= 400),
  -- Explicação completa opcional, em markdown.
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger glossary_terms_set_updated_at
before update on public.glossary_terms
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.guide_steps enable row level security;
alter table public.user_guide_progress enable row level security;
alter table public.glossary_terms enable row level security;

revoke all on public.guide_steps, public.user_guide_progress, public.glossary_terms from anon;

create policy "guide_steps: logados leem as publicadas" on public.guide_steps for select to authenticated
  using (published or (select public.is_admin()));
create policy "guide_steps: admin altera" on public.guide_steps for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "progress: dono lê" on public.user_guide_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy "progress: dono marca" on public.user_guide_progress for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "progress: dono desmarca" on public.user_guide_progress for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.user_guide_progress from authenticated;

create policy "glossary: logados leem" on public.glossary_terms for select to authenticated using (true);
create policy "glossary: admin altera" on public.glossary_terms for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
