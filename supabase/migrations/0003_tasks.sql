-- tasks: user-owned to-do items. Created complete (recurrence + search_vector
-- columns included now) so later phases never ALTER this table. Follows the
-- owner-scoped RLS pattern from 0002_categories.sql.
create type public.task_priority as enum ('none', 'low', 'med', 'high');
create type public.task_status as enum ('todo', 'done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  tags text[] not null default '{}',
  priority public.task_priority not null default 'none',
  due_at timestamptz,
  status public.task_status not null default 'todo',
  recurrence jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Unused until Search; generated from title + description.
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_tags_gin on public.tasks using gin (tags);
create index tasks_search_gin on public.tasks using gin (search_vector);

alter table public.tasks enable row level security;

create policy "tasks are viewable by owner"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "tasks are insertable by owner"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "tasks are updatable by owner"
  on public.tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tasks are deletable by owner"
  on public.tasks for delete
  using (auth.uid() = user_id);
