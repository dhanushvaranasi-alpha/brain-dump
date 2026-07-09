-- categories: user-managed labels shared across tasks and notes.
-- Follows the profiles RLS pattern from 0001. user_id defaults to auth.uid()
-- so inserts from the client never need to pass an explicit owner.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- One category name per user, case-insensitive. Makes "create-on-type" safe:
-- typing an existing name (any casing) collides instead of duplicating.
create unique index categories_user_name_unique
  on public.categories (user_id, lower(name));

-- List queries scope by user_id (RLS) and order by name.
create index categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;

create policy "categories are viewable by owner"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories are insertable by owner"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories are updatable by owner"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories are deletable by owner"
  on public.categories for delete
  using (auth.uid() = user_id);
