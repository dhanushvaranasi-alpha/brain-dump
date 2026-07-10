begin;
select plan(4);

-- RLS is enabled on categories
select ok(
  (select relrowsecurity from pg_class where oid = 'public.categories'::regclass),
  'RLS enabled on categories'
);

-- anon role cannot read categories (no rows visible without auth.uid())
set local role anon;
select is_empty(
  'select 1 from public.categories',
  'anon sees no category rows'
);
reset role;

-- Seed two users, each owning one category, to prove cross-user isolation.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');
insert into public.categories (user_id, name, color) values
  ('11111111-1111-1111-1111-111111111111', 'A Work', '#6366f1'),
  ('22222222-2222-2222-2222-222222222222', 'B Work', '#10b981');

-- As user A (authenticated): sees only their own category, never user B's.
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*) from public.categories',
  ARRAY[1::bigint],
  'user A sees only their own category (cross-user isolation)'
);

-- As user A: cannot delete user B's category (delete policy is owner-scoped).
select is_empty(
  $$ delete from public.categories
     where user_id = '22222222-2222-2222-2222-222222222222'::uuid
     returning 1 $$,
  'user A cannot delete user B category'
);

select * from finish();
rollback;
