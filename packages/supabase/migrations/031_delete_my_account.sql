-- Customer self-service account deletion (required by app stores).
-- Orders must stay for the shops' and riders' records, so the account is anonymised and
-- locked instead of hard-deleted: name/phone are scrubbed, saved addresses removed,
-- and the login is banned so the phone + PIN can no longer sign in.
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'customer' then raise exception 'ONLY_CUSTOMERS_CAN_DELETE_HERE'; end if;
  if exists (
    select 1 from public.orders
    where customer_id = v_uid
      and status in ('PENDING','MERCHANT_ACCEPTED','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY')
  ) then raise exception 'ACTIVE_ORDER_EXISTS'; end if;

  delete from public.customer_addresses where customer_id = v_uid;
  update public.profiles
     set full_name = 'Deleted user', phone = 'deleted-' || replace(v_uid::text, '-', ''), avatar_url = null, fcm_token = null, is_active = false
   where id = v_uid;
  update auth.users
     set banned_until = 'infinity',
         email = 'deleted_' || replace(v_uid::text, '-', '') || '@deleted.bever.app',
         raw_user_meta_data = '{}'::jsonb
   where id = v_uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
