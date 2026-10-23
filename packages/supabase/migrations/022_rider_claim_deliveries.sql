-- BEVER migration 022: riders (and the founder acting as operator) can see and claim ready orders
--
-- Gap found while testing the full flow: after a merchant marks an order READY_FOR_PICKUP, the
-- database only let an ADMIN move it to RIDER_ASSIGNED, and no function created the assignment.
-- Without an admin tool nobody could pick the order up, so every order would stall.
--
-- This adds:
--   list_available_deliveries()  riders see orders that are ready and not yet claimed
--   claim_delivery(order_id)     a rider claims one (first rider wins, atomically)
-- and lets the status trigger accept READY_FOR_PICKUP -> RIDER_ASSIGNED when the rider has just
-- been recorded as the assignee. Riders cannot insert assignments directly (no INSERT policy),
-- so this is only reachable through claim_delivery.
-- Admin assignment keeps working. Safe to run more than once.

create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_role user_role;
begin
  if old.status = new.status then return new; end if;

  select role into v_user_role from profiles where id = auth.uid();

  case old.status
    when 'PENDING' then
      if new.status = 'MERCHANT_ACCEPTED' and v_user_role = 'merchant' then return new; end if;
      if new.status = 'REJECTED'          and v_user_role = 'merchant' then return new; end if;
      if new.status = 'CANCELLED'         and v_user_role in ('customer', 'admin') then return new; end if;

    when 'MERCHANT_ACCEPTED' then
      if new.status = 'PREPARING'  and v_user_role = 'merchant' then return new; end if;
      if new.status = 'CANCELLED'  and v_user_role = 'admin'    then return new; end if;

    when 'PREPARING' then
      if new.status = 'READY_FOR_PICKUP' and v_user_role = 'merchant' then return new; end if;

    when 'READY_FOR_PICKUP' then
      if new.status = 'RIDER_ASSIGNED' and v_user_role = 'admin' then return new; end if;
      if new.status = 'RIDER_ASSIGNED' and v_user_role = 'rider'
         and exists (select 1 from delivery_assignments da where da.order_id = new.id and da.rider_id = auth.uid()) then
        return new;
      end if;

    when 'RIDER_ASSIGNED' then
      if new.status = 'RIDER_AT_STORE'    and v_user_role = 'rider' then return new; end if;
      if new.status = 'READY_FOR_PICKUP'  and v_user_role = 'admin' then return new; end if;

    when 'RIDER_AT_STORE' then
      if new.status = 'PICKED_UP' and v_user_role = 'rider' then return new; end if;

    when 'PICKED_UP' then
      if new.status = 'OUT_FOR_DELIVERY' and v_user_role = 'rider' then return new; end if;

    when 'OUT_FOR_DELIVERY' then
      if new.status = 'DELIVERED'       and v_user_role = 'rider' then return new; end if;
      if new.status = 'DELIVERY_FAILED' and v_user_role in ('rider', 'admin') then return new; end if;

    when 'DELIVERY_FAILED' then
      if new.status = 'REFUND_PENDING' and v_user_role = 'admin' then return new; end if;

    when 'REFUND_PENDING' then
      if new.status = 'REFUNDED' and v_user_role = 'admin' then return new; end if;

    else
      raise exception 'Order % is in terminal state % and cannot be updated.', old.id, old.status using errcode = 'P0001';
  end case;

  raise exception 'Invalid order status transition: % -> % for role %.', old.status, new.status, v_user_role using errcode = 'P0002';
end;
$$;

create or replace function public.list_available_deliveries()
returns table(order_id uuid, order_number text, store_name text, store_address text, delivery_area text,
              items_total integer, total_amount integer, payment_method text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
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
         concat_ws(', ', o.delivery_address_snapshot->>'city', o.delivery_address_snapshot->>'pincode'),
         o.items_total, o.total_amount, o.payment_method::text, o.created_at
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.status = 'READY_FOR_PICKUP'
    and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id)
  order by o.created_at asc
  limit 50;
end;
$function$;

create or replace function public.claim_delivery(p_order_id uuid)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_role public.user_role;
  v_order public.orders;
  v_assignment public.delivery_assignments;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.role into v_role from public.profiles p where p.id = v_uid and p.is_active = true;
  if v_role is distinct from 'rider'::public.user_role then raise exception 'ROLE_NOT_ALLOWED'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'READY_FOR_PICKUP' then raise exception 'ORDER_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.delivery_assignments da where da.order_id = p_order_id) then
    raise exception 'ORDER_ALREADY_CLAIMED';
  end if;

  insert into public.delivery_assignments (order_id, rider_id, assigned_by, accepted_at)
  values (p_order_id, v_uid, v_uid, now())
  returning * into v_assignment;

  update public.orders set status = 'RIDER_ASSIGNED', updated_at = now() where id = p_order_id;
  return v_assignment;
end;
$function$;

revoke execute on function public.list_available_deliveries() from public, anon;
grant execute on function public.list_available_deliveries() to authenticated;
revoke execute on function public.claim_delivery(uuid) from public, anon;
grant execute on function public.claim_delivery(uuid) to authenticated;
