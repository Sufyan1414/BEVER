-- Exact locations for riders: store and drop-off coordinates, so the app can open turn-by-turn navigation directly.
-- Also lets approve_merchant use the GPS location the shopkeeper captured at registration.

drop function if exists public.list_available_deliveries();
create function public.list_available_deliveries()
returns table(order_id uuid, order_number text, store_name text, store_address text, store_lat double precision, store_lng double precision,
              delivery_area text, drop_address text, drop_lat double precision, drop_lng double precision,
              items_total integer, total_amount integer, payment_method text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $function$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid and p.is_active = true;
  if v_role is distinct from 'rider'::public.user_role then raise exception 'ROLE_NOT_ALLOWED'; end if;

  return query
  select o.id, o.order_number, s.name, s.address_text,
         extensions.st_y(s.location), extensions.st_x(s.location),
         concat_ws(', ', o.delivery_address_snapshot->>'city', o.delivery_address_snapshot->>'pincode'),
         concat_ws(', ', o.delivery_address_snapshot->>'address_line_1', o.delivery_address_snapshot->>'address_line_2',
                         o.delivery_address_snapshot->>'city', o.delivery_address_snapshot->>'pincode'),
         extensions.st_y(ca.location), extensions.st_x(ca.location),
         o.items_total, o.total_amount, o.payment_method::text, o.created_at
  from public.orders o
  join public.stores s on s.id = o.store_id
  left join public.customer_addresses ca on ca.id = o.delivery_address_id
  where o.status = 'READY_FOR_PICKUP'
    and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id)
  order by o.created_at asc
  limit 50;
end;
$function$;

-- Full route details for ONE delivery. Customer name/phone are only revealed to the rider who holds the delivery.
create or replace function public.get_delivery_route(p_order_id uuid)
returns table(store_name text, store_phone text, store_address text, store_lat double precision, store_lng double precision,
              customer_name text, customer_phone text, drop_label text, drop_address text, drop_lat double precision, drop_lng double precision)
language plpgsql
security definer
set search_path = public, extensions
as $function$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_mine boolean;
  v_open boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid and p.is_active = true;
  if v_role is distinct from 'rider'::public.user_role then raise exception 'ROLE_NOT_ALLOWED'; end if;

  select exists (select 1 from public.delivery_assignments da where da.order_id = p_order_id and da.rider_id = v_uid) into v_mine;
  select exists (select 1 from public.orders o where o.id = p_order_id and o.status = 'READY_FOR_PICKUP'
                 and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id)) into v_open;
  if not v_mine and not v_open then raise exception 'ORDER_NOT_AVAILABLE'; end if;

  return query
  select s.name, s.phone, s.address_text, extensions.st_y(s.location), extensions.st_x(s.location),
         case when v_mine then cp.full_name end, case when v_mine then cp.phone end,
         o.delivery_address_snapshot->>'label',
         concat_ws(', ', o.delivery_address_snapshot->>'address_line_1', o.delivery_address_snapshot->>'address_line_2',
                         o.delivery_address_snapshot->>'city', o.delivery_address_snapshot->>'pincode'),
         extensions.st_y(ca.location), extensions.st_x(ca.location)
  from public.orders o
  join public.stores s on s.id = o.store_id
  join public.profiles cp on cp.id = o.customer_id
  left join public.customer_addresses ca on ca.id = o.delivery_address_id
  where o.id = p_order_id;
end;
$function$;

revoke execute on function public.list_available_deliveries() from public, anon;
grant execute on function public.list_available_deliveries() to authenticated;
revoke execute on function public.get_delivery_route(uuid) from public, anon;
grant execute on function public.get_delivery_route(uuid) to authenticated;

-- approve_merchant: lat/lng now optional. If omitted, uses the location the shopkeeper captured in the app.
drop function if exists public.approve_merchant(text, double precision, double precision, integer);
create function public.approve_merchant(p_phone text, p_lat double precision default null, p_lng double precision default null, p_radius integer default 3000)
returns text
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_digits text := regexp_replace(p_phone, '[^0-9]', '', 'g');
  v_user uuid; v_app jsonb; v_store uuid; v_lat double precision; v_lng double precision;
begin
  if length(v_digits) = 10 then v_digits := '91' || v_digits; end if;
  select id, raw_user_meta_data -> 'merchant_application' into v_user, v_app
    from auth.users where email = 'customer_' || v_digits || '@bever.app';
  if v_user is null then raise exception 'No account for %', p_phone; end if;
  if v_app is null then raise exception 'No shop application for %', p_phone; end if;

  v_lat := coalesce(p_lat, nullif(v_app ->> 'lat', '')::double precision);
  v_lng := coalesce(p_lng, nullif(v_app ->> 'lng', '')::double precision);
  if v_lat is null or v_lng is null then
    raise exception 'No shop location. The shopkeeper did not capture GPS; pass lat and lng explicitly.';
  end if;

  update public.profiles set role = 'merchant', is_active = true,
         full_name = coalesce(v_app ->> 'owner_name', full_name) where id = v_user;

  select id into v_store from public.stores where merchant_id = v_user limit 1;
  if v_store is null then
    insert into public.stores (merchant_id, name, phone, address_text, location, category,
        is_open, is_verified, is_active, minimum_order_amount, service_radius_meters)
    values (v_user, v_app ->> 'store_name', '+' || v_digits,
        (v_app ->> 'address') || ', ' || (v_app ->> 'city') || ' ' || (v_app ->> 'pincode'),
        st_setsrid(st_makepoint(v_lng, v_lat), 4326), (v_app ->> 'category')::public.store_category,
        true, true, true, 0, p_radius)
    returning id into v_store;
    return 'Approved. Store created: ' || (v_app ->> 'store_name') || ' at ' || v_lat || ', ' || v_lng;
  end if;
  return 'Approved. Store already existed; role set to merchant.';
end $$;
revoke all on function public.approve_merchant(text, double precision, double precision, integer) from public, anon, authenticated;
