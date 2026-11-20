-- BEVER migration 040: fixes for the Supabase Security Advisor. Safe to re-run.
--
-- 1. public.spatial_ref_sys (PostGIS coordinate-system list, no user data) had RLS off.
--    It belongs to the PostGIS extension, so the owner may refuse; every step is guarded.
-- 2. Own functions without a fixed search_path get one (blocks search-path hijacking).
--    PostGIS's own functions are skipped.

do $$
begin
  begin
    alter table public.spatial_ref_sys enable row level security;
    drop policy if exists "spatial_ref_sys: public read" on public.spatial_ref_sys;
    create policy "spatial_ref_sys: public read" on public.spatial_ref_sys
      for select to anon, authenticated using (true);
    revoke insert, update, delete, truncate on public.spatial_ref_sys from anon, authenticated;
  exception when insufficient_privilege then
    raise notice 'spatial_ref_sys is owned by the PostGIS extension; RLS left as is (reference data only).';
  end;
end $$;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;
