-- BEVER migration 019
-- Record why a rider marked an order as delivery failed.

alter table public.orders add column if not exists delivery_failure_reason text;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders;
  v_from_status public.order_status;
  v_role public.user_role;
  v_uid uuid := (select auth.uid());
  v_allowed boolean := false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_from_status := v_order.status;

  select role into v_role from public.profiles
  where id = v_uid and is_active = true;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  if v_role = 'admin' then
    v_allowed := true;
  elsif v_role = 'customer' then
    v_allowed := v_order.customer_id = v_uid
      and v_from_status = 'PENDING' and p_to_status = 'CANCELLED';
  elsif v_role = 'merchant' then
    v_allowed := exists (
      select 1 from public.stores s
      where s.id = v_order.store_id and s.merchant_id = v_uid
    ) and (
      (v_from_status = 'PENDING' and p_to_status in ('MERCHANT_ACCEPTED','REJECTED')) or
      (v_from_status = 'MERCHANT_ACCEPTED' and p_to_status = 'PREPARING') or
      (v_from_status = 'PREPARING' and p_to_status = 'READY_FOR_PICKUP')
    );
  elsif v_role = 'rider' then
    v_allowed := exists (
      select 1 from public.delivery_assignments da
      where da.order_id = v_order.id and da.rider_id = v_uid
    ) and (
      (v_from_status = 'RIDER_ASSIGNED' and p_to_status = 'RIDER_AT_STORE') or
      (v_from_status = 'RIDER_AT_STORE' and p_to_status = 'PICKED_UP') or
      (v_from_status = 'PICKED_UP' and p_to_status = 'OUT_FOR_DELIVERY') or
      (v_from_status = 'OUT_FOR_DELIVERY' and p_to_status = 'DELIVERY_FAILED')
    );
  end if;

  if not v_allowed then raise exception 'ROLE_NOT_ALLOWED'; end if;

  update public.orders
  set status = p_to_status,
      cancellation_reason = case when p_to_status = 'CANCELLED' then nullif(trim(p_note), '') else cancellation_reason end,
      rejection_reason = case when p_to_status = 'REJECTED' then nullif(trim(p_note), '') else rejection_reason end,
      delivery_failure_reason = case when p_to_status = 'DELIVERY_FAILED' then nullif(trim(p_note), '') else delivery_failure_reason end,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  if v_role = 'rider' then
    update public.delivery_assignments
    set arrived_at_store_at = case when p_to_status = 'RIDER_AT_STORE' then coalesce(arrived_at_store_at, now()) else arrived_at_store_at end,
        picked_up_at = case when p_to_status = 'PICKED_UP' then coalesce(picked_up_at, now()) else picked_up_at end,
        updated_at = now()
    where order_id = v_order.id and rider_id = v_uid;
  end if;

  return v_order;
end;
$function$;

revoke execute on function public.transition_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated;
