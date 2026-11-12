-- 036: performance hardening for ~500 customers / 50–80 shops / 20 riders.
-- Safe to re-run.

-- 1. Hot-path indexes ---------------------------------------------------------
create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists idx_products_store_live on public.products (store_id) where is_active and is_available;
create index if not exists idx_products_deals on public.products (store_id) where is_active and is_available and compare_at_price is not null;

create index if not exists idx_orders_customer_created on public.orders (customer_id, created_at desc);
create index if not exists idx_orders_store_status_created on public.orders (store_id, status, created_at desc);
create index if not exists idx_orders_active_by_status on public.orders (status, created_at)
  where status in ('PENDING','MERCHANT_ACCEPTED','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY');

create index if not exists idx_order_items_created on public.order_items (created_at desc);
create index if not exists idx_order_items_product on public.order_items (product_id);

create index if not exists idx_delivery_assignments_order_status on public.delivery_assignments (order_id, status);
create index if not exists idx_rider_locations_rider on public.rider_locations (rider_id);

-- 2. RLS: evaluate auth.uid() once per query instead of once per row ----------
-- (policy text "auth.uid()" -> "(select auth.uid())"; Postgres then plans it as an init-plan.)
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and ((qual like '%auth.uid()%' and qual not like '%select auth.uid()%')
        or (with_check like '%auth.uid()%' and with_check not like '%select auth.uid()%'))
  loop
    begin
      v_using := replace(r.qual, 'auth.uid()', '(select auth.uid())');
      v_check := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
      v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
      if r.qual is not null then v_sql := v_sql || ' using (' || v_using || ')'; end if;
      if r.with_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
      execute v_sql;
    exception when others then
      raise notice 'skipped policy % on %: %', r.policyname, r.tablename, sqlerrm;
    end;
  end loop;
end $$;

-- 3. Housekeeping: stale live-location rows of finished orders ----------------
create or replace function public.prune_rider_locations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.rider_locations rl
  using public.orders o
  where o.id = rl.order_id and o.status in ('DELIVERED','CANCELLED','REJECTED','DELIVERY_FAILED')
    and rl.updated_at < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.prune_rider_locations() from public, anon, authenticated;

analyze;
