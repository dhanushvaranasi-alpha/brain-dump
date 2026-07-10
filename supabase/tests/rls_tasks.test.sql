begin;
select plan(4);

-- RLS is enabled on tasks
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tasks'::regclass),
  'RLS enabled on tasks'
);

-- anon role cannot read tasks (no rows visible without auth.uid())
set local role anon;
select is_empty(
  'select 1 from public.tasks',
  'anon sees no task rows'
);
reset role;

-- Seed two users, each owning one task, to prove cross-user isolation.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');
insert into public.tasks (user_id, title) values
  ('11111111-1111-1111-1111-111111111111', 'A task'),
  ('22222222-2222-2222-2222-222222222222', 'B task');

-- As user A (authenticated): sees only their own task, never user B's.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*) from public.tasks',
  ARRAY[1::bigint],
  'user A sees only their own task (cross-user isolation)'
);

-- As user A: cannot delete user B's task (delete policy is owner-scoped).
select is_empty(
  $$ delete from public.tasks
     where user_id = '22222222-2222-2222-2222-222222222222'::uuid
     returning 1 $$,
  'user A cannot delete user B task'
);

select * from finish();
rollback;
