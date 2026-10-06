-- 015_rider_workflow_hardening.sql
-- Server-side rider action boundaries, assignment timestamps, OTP/COD enforcement.

create or replace function public.accept_delivery_assignment(p_order_id uuid)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_assignment public.delivery_assignments;
  v_status public.order_status;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid and is_active = true;
  if v_role <> 'rider' then raise exception 'ROLE_NOT_ALLOWED'; end if;
  select da.* into v_assignment
  from public.delivery_assignments da
  where da.order_id = p_order_id and da.rider_id = v_uid
  for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status <> 'RIDER_ASSIGNED' then raise exception 'INVALID_ORDER_STATUS'; end if;
  update public.delivery_assignments
  set accepted_at = coalesce(accepted_at, now()), updated_at = now()
  where id = v_assignment.id
  returning * into v_assignment;
  return v_assignment;
end;
$function$;

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
  select role into v_role from public.profiles where id = v_uid and is_active = true;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  if v_role = 'admin' then
    v_allowed := true;
  elsif v_role = 'customer' then
    v_allowed := v_order.customer_id = v_uid and v_from_status = 'PENDING' and p_to_status = 'CANCELLED';
  elsif v_role = 'merchant' then
    v_allowed := exists (
      select 1 from public.stores s where s.id = v_order.store_id and s.merchant_id = v_uid
    ) and (
      (v_from_status = 'PENDING' and p_to_status in ('MERCHANT_ACCEPTED','REJECTED')) or
      (v_from_status = 'MERCHANT_ACCEPTED' and p_to_status = 'PREPARING') or
      (v_from_status = 'PREPARING' and p_to_status = 'READY_FOR_PICKUP')
    );
  elsif v_role = 'rider' then
    v_allowed := exists (
      select 1 from public.delivery_assignments da where da.order_id = v_order.id and da.rider_id = v_uid
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

create or replace function public.complete_order_delivery(
  p_order_id uuid,
  p_delivery_otp text,
  p_cod_collected boolean default false,
  p_failure_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid and is_active = true;
  if v_role <> 'rider' then raise exception 'ROLE_NOT_ALLOWED'; end if;
  select o.* into v_order
  from public.orders o
  join public.delivery_assignments da on da.order_id = o.id and da.rider_id = v_uid
  where o.id = p_order_id for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if v_order.status <> 'OUT_FOR_DELIVERY' then raise exception 'INVALID_ORDER_STATUS'; end if;
  if p_delivery_otp is null or p_delivery_otp !~ '^\\d{4}$' or p_delivery_otp <> v_order.delivery_otp then
    raise exception 'INVALID_DELIVERY_OTP';
  end if;
  if v_order.payment_method = 'COD' and coalesce(p_cod_collected, false) <> true then
    raise exception 'COD_NOT_COLLECTED';
  end if;
  update public.orders
  set status = 'DELIVERED', delivered_at = now(), updated_at = now()
  where id = v_order.id
  returning * into v_order;
  update public.delivery_assignments
  set delivered_at = now(),
      cod_collected = case when v_order.payment_method = 'COD' then true else cod_collected end,
      cod_amount = case when v_order.payment_method = 'COD' then v_order.total_amount else cod_amount end,
      updated_at = now()
  where order_id = v_order.id and rider_id = v_uid;
  return v_order;
end;
$function$;

revoke execute on function public.accept_delivery_assignment(uuid) from public, anon;
grant execute on function public.accept_delivery_assignment(uuid) to authenticated;
revoke execute on function public.transition_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated;
revoke execute on function public.complete_order_delivery(uuid, text, boolean, text) from public, anon;
grant execute on function public.complete_order_delivery(uuid, text, boolean, text) to authenticated;
