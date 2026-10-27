-- Live rider tracking: the rider app posts its position while a delivery is active; the customer who owns
-- the order can read it (and only while the order is in the delivery phase).

create table if not exists public.rider_locations (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  rider_id   uuid not null references public.profiles(id) on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  updated_at timestamptz not null default now()
);
alter table public.rider_locations enable row level security;
revoke all on public.rider_locations from anon, authenticated;   -- access only through the RPCs below

create or replace function public.update_rider_location(p_order_id uuid, p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'INVALID_LOCATION'; end if;
  if not exists (
    select 1 from public.delivery_assignments da join public.orders o on o.id = da.order_id
    where da.order_id = p_order_id and da.rider_id = v_uid
      and o.status in ('RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY')
  ) then raise exception 'NOT_YOUR_ACTIVE_DELIVERY'; end if;

  insert into public.rider_locations (order_id, rider_id, lat, lng, updated_at)
  values (p_order_id, v_uid, p_lat, p_lng, now())
  on conflict (order_id) do update set lat = excluded.lat, lng = excluded.lng, rider_id = excluded.rider_id, updated_at = now();
end;
$function$;

-- What the customer sees on the tracking screen: rider first name + phone, last position, and the two endpoints.
create or replace function public.get_order_tracking(p_order_id uuid)
returns table(status text, rider_name text, rider_phone text, rider_lat double precision, rider_lng double precision,
              rider_updated_at timestamptz, store_name text, store_lat double precision, store_lng double precision,
              drop_lat double precision, drop_lng double precision)
language plpgsql
security definer
set search_path = public, extensions
as $function$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.orders o where o.id = p_order_id and o.customer_id = v_uid) then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return query
  select o.status::text,
         case when o.status in ('RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY') then split_part(rp.full_name, ' ', 1) end,
         case when o.status in ('RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY') then rp.phone end,
         case when o.status in ('RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY') then rl.lat end,
         case when o.status in ('RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY') then rl.lng end,
         rl.updated_at,
         s.name, extensions.st_y(s.location), extensions.st_x(s.location),
         extensions.st_y(ca.location), extensions.st_x(ca.location)
  from public.orders o
  join public.stores s on s.id = o.store_id
  left join public.customer_addresses ca on ca.id = o.delivery_address_id
  left join public.delivery_assignments da on da.order_id = o.id
  left join public.profiles rp on rp.id = da.rider_id
  left join public.rider_locations rl on rl.order_id = o.id
  where o.id = p_order_id;
end;
$function$;

revoke execute on function public.update_rider_location(uuid, double precision, double precision) from public, anon;
grant execute on function public.update_rider_location(uuid, double precision, double precision) to authenticated;
revoke execute on function public.get_order_tracking(uuid) from public, anon;
grant execute on function public.get_order_tracking(uuid) to authenticated;
