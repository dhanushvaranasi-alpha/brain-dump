begin;
select plan(2);

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

select * from finish();
rollback;
