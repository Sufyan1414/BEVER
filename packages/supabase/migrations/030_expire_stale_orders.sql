-- BEVER migration 030: automatic housekeeping for orders nobody answers.
--
-- A customer's PENDING order that the shop never accepts or rejects would hang forever.
-- expire_stale_orders() cancels PENDING orders older than N minutes with a clear reason.
-- Run it by hand, or schedule it (Supabase: Database -> Cron, or pg_cron) every minute:
--   select cron.schedule('bever-expire-orders', '* * * * *', $$select public.expire_stale_orders(15)$$);
-- The status trigger gets a transaction-local bypass that only this function sets.

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

create or replace function public.expire_stale_orders(p_minutes integer default 15)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_n integer;
begin
  perform set_config('bever.system_update', 'on', true);
  update public.orders
     set status = 'CANCELLED',
         cancellation_reason = 'The shop did not respond in time. You have not been charged.'
   where status = 'PENDING'
     and created_at < now() - make_interval(mins => greatest(p_minutes, 1));
  get diagnostics v_n = row_count;
  perform set_config('bever.system_update', 'off', true);
  return v_n;
end $$;
revoke all on function public.expire_stale_orders(integer) from public, anon, authenticated;
