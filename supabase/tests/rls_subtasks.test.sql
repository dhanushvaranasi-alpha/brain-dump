begin;
select plan(4);

-- RLS is enabled on subtasks
select ok(
  (select relrowsecurity from pg_class where oid = 'public.subtasks'::regclass),
  'RLS enabled on subtasks'
);

-- anon role cannot read subtasks
set local role anon;
select is_empty(
  'select 1 from public.subtasks',
  'anon sees no subtask rows'
);
reset role;

-- Seed two users, each with a task and one subtask, to prove cross-user isolation.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');
insert into public.tasks (id, user_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'A task'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'B task');
insert into public.subtasks (task_id, title) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A subtask'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B subtask');

-- As user A: sees only their own subtask (via the parent task).
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*) from public.subtasks',
  ARRAY[1::bigint],
  'user A sees only their own subtask (cross-user isolation)'
);

-- As user A: cannot delete user B's subtask.
select is_empty(
  $$ delete from public.subtasks
     where task_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
     returning 1 $$,
  'user A cannot delete user B subtask'
);

select * from finish();
rollback;
