begin;
select plan(2);

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

select * from finish();
rollback;
