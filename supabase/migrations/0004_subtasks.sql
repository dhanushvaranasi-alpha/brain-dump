-- subtasks: ordered checklist items belonging to a task. Owner-scoped through
-- the parent task's user_id (RLS), following the pattern of the other tables.
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index subtasks_task_id_idx on public.subtasks (task_id);

alter table public.subtasks enable row level security;

-- Ownership is derived from the parent task. A subtask row is visible/mutable
-- only when its task belongs to the current user.
create policy "subtasks are viewable by task owner"
  on public.subtasks for select
  using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

create policy "subtasks are insertable by task owner"
  on public.subtasks for insert
  with check (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

create policy "subtasks are updatable by task owner"
  on public.subtasks for update
  using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  )
  with check (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );

create policy "subtasks are deletable by task owner"
  on public.subtasks for delete
  using (
    task_id in (select id from public.tasks where user_id = auth.uid())
  );
