-- Operator approval helpers. Run from the Supabase SQL editor (postgres role) ONLY.
-- Not callable by app users: execute is revoked from anon/authenticated.

create or replace function public.pending_applications()
returns table (phone text, kind text, applied_at timestamptz, details jsonb)
language sql security definer set search_path = public, auth as $$
  select p.phone, 'merchant', u.created_at, u.raw_user_meta_data -> 'merchant_application'
    from auth.users u join public.profiles p on p.id = u.id
   where u.raw_user_meta_data ? 'merchant_application' and p.role <> 'merchant'
  union all
  select p.phone, 'rider', u.created_at, u.raw_user_meta_data -> 'rider_application'
    from auth.users u join public.profiles p on p.id = u.id
   where u.raw_user_meta_data ? 'rider_application' and p.role <> 'rider'
  order by 3 desc;
$$;

create or replace function public.approve_merchant(p_phone text, p_lat double precision, p_lng double precision, p_radius integer default 3000)
returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_digits text := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_user uuid; v_app jsonb; v_store uuid;
begin
  if length(v_digits) = 10 then v_digits := '91' || v_digits; end if;
  select id, raw_user_meta_data -> 'merchant_application' into v_user, v_app
    from auth.users where email = 'customer_' || v_digits || '@bever.app';
  if v_user is null then raise exception 'No account for %', p_phone; end if;
  if v_app is null then raise exception 'No shop application for %', p_phone; end if;

  update public.profiles set role = 'merchant', is_active = true,
         full_name = coalesce(v_app ->> 'owner_name', full_name) where id = v_user;

  select id into v_store from public.stores where merchant_id = v_user limit 1;
  if v_store is null then
    insert into public.stores (merchant_id, name, phone, address_text, location, category,
        is_open, is_verified, is_active, minimum_order_amount, service_radius_meters)
    values (v_user, v_app ->> 'store_name', '+' || v_digits,
        (v_app ->> 'address') || ', ' || (v_app ->> 'city') || ' ' || (v_app ->> 'pincode'),
        st_setsrid(st_makepoint(p_lng, p_lat), 4326), (v_app ->> 'category')::public.store_category,
        true, true, true, 0, p_radius)
    returning id into v_store;
    return 'Approved. Store created: ' || (v_app ->> 'store_name');
  end if;
  return 'Approved. Store already existed; role set to merchant.';
end $$;

create or replace function public.approve_rider(p_phone text)
returns text
language plpgsql security definer set search_path = public, auth as $$
declare v_digits text := regexp_replace(p_phone, '[^0-9]', '', 'g'); v_user uuid; v_app jsonb;
begin
  if length(v_digits) = 10 then v_digits := '91' || v_digits; end if;
  select id, raw_user_meta_data -> 'rider_application' into v_user, v_app
    from auth.users where email = 'customer_' || v_digits || '@bever.app';
  if v_user is null then raise exception 'No account for %', p_phone; end if;
  if v_app is null then raise exception 'No rider application for %', p_phone; end if;
  update public.profiles set role = 'rider', is_active = true,
         full_name = coalesce(v_app ->> 'full_name', full_name) where id = v_user;
  return 'Approved rider ' || p_phone;
end $$;

revoke all on function public.pending_applications() from public, anon, authenticated;
revoke all on function public.approve_merchant(text, double precision, double precision, integer) from public, anon, authenticated;
revoke all on function public.approve_rider(text) from public, anon, authenticated;
