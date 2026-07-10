begin;
select plan(3);

-- RLS is enabled on profiles
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS enabled on profiles'
);

-- anon role cannot read profiles (no rows visible without auth.uid())
set local role anon;
select is_empty(
  'select 1 from public.profiles',
  'anon sees no profile rows'
);
reset role;

-- Seed two users; the on_auth_user_created trigger auto-creates a profile for
-- each. As user A, RLS must expose only user A's own profile row.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select count(*) from public.profiles',
  ARRAY[1::bigint],
  'user A sees only their own profile (cross-user isolation)'
);

select * from finish();
rollback;
