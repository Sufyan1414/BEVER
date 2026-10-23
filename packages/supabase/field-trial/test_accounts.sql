-- BEVER automated-test accounts (NOT a migration; run once by hand in the Supabase SQL editor).
--
-- The CI "full flow" test plays customer, merchant and rider against the real backend. It signs up
-- two test logins by itself (+919000000002 merchant, +919000000003 rider). Run this once AFTER the
-- first CI run has created them, so they get the right roles and a CLOSED test store
-- ("BEVER E2E Test Store"). The test opens that store only while it runs and closes it again, so real
-- customers never see it. Safe to run more than once.

do $$
declare
  v_merchant uuid;
  v_rider uuid;
  v_store uuid;
begin
  select id into v_merchant from auth.users where email = 'customer_919000000002@bever.app';
  select id into v_rider    from auth.users where email = 'customer_919000000003@bever.app';
  if v_merchant is null or v_rider is null then
    raise exception 'Test logins not created yet. Push any commit, wait for CI, then run this again.';
  end if;

  update public.profiles set role = 'merchant', full_name = 'E2E Test Merchant', is_active = true where id = v_merchant;
  update public.profiles set role = 'rider',    full_name = 'E2E Test Rider',    is_active = true where id = v_rider;

  select id into v_store from public.stores where merchant_id = v_merchant;
  if v_store is null then
    insert into public.stores
      (merchant_id, name, phone, address_text, location, category,
       is_open, is_verified, is_active, minimum_order_amount, service_radius_meters)
    values
      (v_merchant, 'BEVER E2E Test Store', '+919000000002', 'Automated test store, do not order',
       st_setsrid(st_makepoint(75.3433, 19.8762), 4326), 'GROCERY',
       false, true, true, 0, 5000)
    returning id into v_store;
  end if;

  if not exists (select 1 from public.products where store_id = v_store) then
    insert into public.products (store_id, name, unit, price, is_available, is_active)
    values (v_store, 'Test item', '1 pc', 1000, true, true);
  end if;

  raise notice 'Test merchant, rider and closed E2E store are ready (store %).', v_store;
end
$$;
