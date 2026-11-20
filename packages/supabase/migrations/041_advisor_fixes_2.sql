-- BEVER migration 041: second round of Security Advisor fixes. Safe to re-run.
--
-- 1. Public image buckets no longer allow anyone to LIST every file name.
--    Images still load through their public URLs; only the directory listing is closed.
-- 2. Internal trigger functions can no longer be called directly by anyone.
--    (Triggers keep working; they do not need the callers' EXECUTE right.)
-- 3. ensure_my_profile is for signed-in users only.

drop policy if exists "Public Read Product Images" on storage.objects;
drop policy if exists "Public Read Store Banners" on storage.objects;
drop policy if exists "Public Read Store Logos" on storage.objects;
drop policy if exists "Public Read User Avatars" on storage.objects;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('handle_new_user', 'restore_stock_on_cancel', 'rls_auto_enable')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'ensure_my_profile'
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;
