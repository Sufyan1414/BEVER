-- BEVER migration 020 (NOT APPLIED — review against the live database first)
--
-- Migration 015 validates the delivery OTP with  p_delivery_otp !~ '^\\d{4}$'.
-- With standard_conforming_strings = on, '\\d' reaches the regex engine as an
-- escaped backslash followed by "d", so a valid 4-digit OTP never matches and
-- complete_order_delivery() would reject every delivery with INVALID_DELIVERY_OTP.
--
-- Before applying: confirm the live function body (select pg_get_functiondef(...)).
-- The live project may already differ from the repo's 015 file. This migration is
-- the correct-regex version of the 015 function and is intended to be replaced by
-- the order-PIN work in the BRD (section 7.2).

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
  if p_delivery_otp is null or p_delivery_otp !~ '^[0-9]{4}$' or p_delivery_otp <> v_order.delivery_otp then
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

revoke execute on function public.complete_order_delivery(uuid, text, boolean, text) from public, anon;
grant execute on function public.complete_order_delivery(uuid, text, boolean, text) to authenticated;
