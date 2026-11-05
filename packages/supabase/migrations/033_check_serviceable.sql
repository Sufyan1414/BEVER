-- Tells the app BEFORE checkout whether a shop delivers to a point, so customers never
-- hit "address is not serviceable" after filling everything in.
-- check_point_serviceable: for any lat/lng (e.g. the browsing location or GPS).
-- check_address_serviceable: for one of the caller's saved addresses.
create or replace function public.check_point_serviceable(p_store_id uuid, p_lat double precision, p_lng double precision)
returns table(serviceable boolean, distance_meters integer, radius_meters integer)
language sql stable security definer set search_path = public, extensions
as $$
  select
    ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) <= s.service_radius_meters,
    round(ST_Distance(s.location::geography, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography))::integer,
    s.service_radius_meters
  from public.stores s
  where s.id = p_store_id and s.location is not null and s.service_radius_meters is not null;
$$;
revoke execute on function public.check_point_serviceable(uuid, double precision, double precision) from public, anon;
grant execute on function public.check_point_serviceable(uuid, double precision, double precision) to authenticated;

create or replace function public.check_address_serviceable(p_store_id uuid, p_address_id uuid)
returns table(serviceable boolean, has_pin boolean, distance_meters integer, radius_meters integer)
language sql stable security definer set search_path = public, extensions
as $$
  select
    case when a.location is null then false
         else ST_Distance(s.location::geography, a.location::geography) <= s.service_radius_meters end,
    a.location is not null,
    case when a.location is null then null
         else round(ST_Distance(s.location::geography, a.location::geography))::integer end,
    s.service_radius_meters
  from public.stores s
  join public.customer_addresses a on a.id = p_address_id and a.customer_id = auth.uid()
  where s.id = p_store_id and s.location is not null and s.service_radius_meters is not null;
$$;
revoke execute on function public.check_address_serviceable(uuid, uuid) from public, anon;
grant execute on function public.check_address_serviceable(uuid, uuid) to authenticated;
