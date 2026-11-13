-- 037: fix "Could not cancel order".
-- Root cause: the order state-machine trigger only let a customer cancel while PENDING, so cancelling
-- after the shop accepted was rejected by the database even though the app offered the button.
-- This migration (a) lets a customer cancel in PENDING or MERCHANT_ACCEPTED, and (b) adds one
-- self-contained RPC, cancel_my_order(), with clear error codes. Safe to re-run.

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
  -- Server-side housekeeping (expire_stale_orders) sets this flag for the current transaction only.
  if current_setting('bever.system_update', true) = 'on' then return new; end if;

  select role into v_user_role from profiles where id = auth.uid();

  case old.status
    when 'PENDING' then
      if new.status = 'MERCHANT_ACCEPTED' and v_user_role = 'merchant' then return new; end if;
      if new.status = 'REJECTED'          and v_user_role = 'merchant' then return new; end if;
      if new.status = 'CANCELLED'         and v_user_role in ('customer', 'admin') then return new; end if;

    when 'MERCHANT_ACCEPTED' then
      if new.status = 'PREPARING'  and v_user_role = 'merchant' then return new; end if;
      if new.status = 'CANCELLED'  and v_user_role in ('customer', 'admin') then return new; end if;

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

create or replace function public.cancel_my_order(p_order_id uuid, p_reason text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status public.order_status;
  v_owner uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select status, customer_id into v_status, v_owner from public.orders where id = p_order_id for update;
  if not found or v_owner <> v_uid then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_status = 'CANCELLED' then return 'CANCELLED'; end if;
  if v_status not in ('PENDING', 'MERCHANT_ACCEPTED') then raise exception 'TOO_LATE:%', v_status; end if;
  update public.orders
     set status = 'CANCELLED',
         cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Customer cancelled the order.'),
         updated_at = now()
   where id = p_order_id;
  return 'CANCELLED';
end;
$$;
revoke execute on function public.cancel_my_order(uuid, text) from public, anon;
grant execute on function public.cancel_my_order(uuid, text) to authenticated;
