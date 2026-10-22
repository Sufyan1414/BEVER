-- BEVER field trial: onboard ONE real shopkeeper (NOT a migration; run by hand).
--
-- Run in the Supabase dashboard > SQL editor (runs as the postgres role, so the
-- column restrictions that apply to app users do not block it).
--
-- Before running:
--   1. The shopkeeper registers in the BEVER Merchant app (Register your shop). Their details are saved with the account.
--   2. Set the phone, and the shop's real latitude/longitude below (Google Maps: long-press the shop).
--
-- It makes the profile a merchant, creates their store (open, verified, with a delivery radius) and
-- sets minimum_order_amount = 0 on purpose: the rupees-vs-paise question for that column is
-- unresolved (see BEVER_PROJECT_STATUS.md), so no minimum is enforced during the trial.

do $$
declare
  v_phone   text             := '+919876543210';              -- the shopkeeper's registered mobile, +91 then 10 digits
  v_lat     double precision := 19.8762;                      -- REPLACE with the shop's real latitude (Google Maps: long-press the shop)
  v_lng     double precision := 75.3433;                      -- REPLACE with the shop's real longitude
  v_radius  integer          := 3000;                         -- delivery radius in metres
  v_app     jsonb;
  v_user    uuid;
  v_store_id uuid;
begin
  select id, raw_user_meta_data -> 'merchant_application'
    into v_user, v_app
  from auth.users
  where email = 'customer_' || regexp_replace(v_phone, '[^0-9]', '', 'g') || '@bever.app';

  if v_user is null then
    raise exception 'No login found for %. The shopkeeper must register in the Merchant app first.', v_phone;
  end if;
  if v_app is null then
    raise exception 'No shop application found for %. Ask them to register through "Register your shop" in the Merchant app.', v_phone;
  end if;

  update public.profiles
  set role = 'merchant', full_name = coalesce(v_app ->> 'owner_name', full_name), is_active = true
  where id = v_user;

  if exists (select 1 from public.stores where merchant_id = v_user) then
    raise exception 'This user already has a store. Nothing was changed except the role.';
  end if;

  insert into public.stores
    (merchant_id, name, phone, address_text, location, category,
     is_open, is_verified, is_active, minimum_order_amount, service_radius_meters)
  values
    (v_user, v_app ->> 'store_name', v_phone,
     (v_app ->> 'address') || ', ' || (v_app ->> 'city') || ' ' || (v_app ->> 'pincode'),
     st_setsrid(st_makepoint(v_lng, v_lat), 4326), (v_app ->> 'category')::public.store_category,
     true, true, true, 0, v_radius)
  returning id into v_store_id;

  raise notice 'Created store % for %  (FSSAI: %, GSTIN: %, hours %-%)', v_store_id, v_phone,
    coalesce(v_app ->> 'fssai', '-'), coalesce(v_app ->> 'gstin', '-'), v_app ->> 'opens_at', v_app ->> 'closes_at';
end
$$;

-- Review pending applications first (what shopkeepers and riders submitted):
-- select email, raw_user_meta_data -> 'merchant_application' as shop, raw_user_meta_data -> 'rider_application' as rider
-- from auth.users
-- where raw_user_meta_data ? 'merchant_application' or raw_user_meta_data ? 'rider_application'
-- order by created_at desc;

-- Add real products for that store (prices are in PAISE: Rs 155 = 15500). Edit, then run.
-- insert into public.products (store_id, name, unit, price, is_available, is_active)
-- select s.id, p.name, p.unit, p.price, true, true
-- from public.stores s
-- join public.profiles pr on pr.id = s.merchant_id and pr.phone = '+919876543210'
-- cross join (values
--   ('Toor Dal',        '1 kg',   15500),
--   ('Sunflower Oil',   '1 L',    15500),
--   ('Basmati Rice',    '5 kg',   64000)
-- ) as p(name, unit, price);

-- Make YOURSELF (or a delivery runner) a rider/operator so you can complete deliveries in the Rider app.
-- They sign up once in the Customer app with their number and PIN first. Then run:
-- update public.profiles set role = 'rider', full_name = 'Rider Name', is_active = true
-- where phone = '+919876543210';
