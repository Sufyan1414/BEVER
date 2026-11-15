-- BEVER migration 039: security hardening (from the pre-launch audit).
-- Safe to run more than once.
--
--  H1  Delivery OTP moved out of `orders` into a table only the customer can read.
--      Riders/merchants can no longer see it (including via realtime).
--  H1b OTP brute force: 5 wrong guesses lock the delivery code (admin must handle).
--  H2  No direct writes to orders / order_items / delivery_assignments / rider_locations.
--      Every change already goes through SECURITY DEFINER functions.
--  H4  Storage: merchants may only write inside their own store's folder;
--      size and file-type limits on all image buckets.
--  M6  Account deletion for merchants and riders (customers already had it).

-- ───────────────────────── H1: delivery OTP vault ─────────────────────────
create table if not exists public.order_delivery_otps (
  order_id   uuid primary key,
  otp        text not null,
  attempts   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.order_delivery_otps enable row level security;

drop policy if exists "otp: customer reads own" on public.order_delivery_otps;
create policy "otp: customer reads own" on public.order_delivery_otps
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and o.customer_id = (select auth.uid())));

revoke all on public.order_delivery_otps from anon, authenticated, public;
grant select (order_id, otp) on public.order_delivery_otps to authenticated;

-- Backfill existing orders, then blank the column.
insert into public.order_delivery_otps (order_id, otp)
select id, delivery_otp from public.orders where delivery_otp is not null
on conflict (order_id) do nothing;

update public.orders set delivery_otp = null where delivery_otp is not null;

-- Any future insert (create_customer_order) is diverted automatically.
create or replace function public.divert_delivery_otp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.delivery_otp is not null then
    insert into public.order_delivery_otps (order_id, otp)
    values (new.id, new.delivery_otp)
    on conflict (order_id) do update set otp = excluded.otp, attempts = 0;
    new.delivery_otp := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_divert_delivery_otp on public.orders;
create trigger trg_divert_delivery_otp
  before insert or update of delivery_otp on public.orders
  for each row execute function public.divert_delivery_otp();

revoke execute on function public.divert_delivery_otp() from public, anon, authenticated;

-- ─────────── H1b: OTP check reads the vault and limits guesses ───────────
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
  v_otp text;
  v_attempts integer;
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

  select otp, attempts into v_otp, v_attempts
  from public.order_delivery_otps where order_id = v_order.id for update;
  if v_otp is null then raise exception 'INVALID_DELIVERY_OTP'; end if;
  if v_attempts >= 5 then raise exception 'OTP_LOCKED'; end if;

  if p_delivery_otp is null or p_delivery_otp !~ '^[0-9]{4}$' or p_delivery_otp <> v_otp then
    -- Count the miss and return normally (an exception would roll the count back).
    update public.order_delivery_otps set attempts = attempts + 1 where order_id = v_order.id;
    return v_order;
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

-- ───────────────────── H2: no direct table writes ─────────────────────
revoke insert, update, delete, truncate on public.orders from anon, authenticated;
revoke insert, update, delete, truncate on public.order_items from anon, authenticated;
revoke insert, update, delete, truncate on public.delivery_assignments from anon, authenticated;
revoke insert, update, delete, truncate on public.rider_locations from anon, authenticated;

drop policy if exists "orders: merchant updates store orders" on public.orders;
drop policy if exists "orders: rider updates assigned" on public.orders;
drop policy if exists "delivery_assignments: rider updates own" on public.delivery_assignments;

-- ───────────────────── H4: storage hardening ─────────────────────
-- Merchants may only touch files inside a folder named after a store they own
-- (the merchant app already uploads to <store_id>/<file>).
do $$
declare b text; act text; pol text;
begin
  foreach b in array array['store-banners','store-logos','product-images'] loop
    foreach act in array array['Upload','Update','Delete'] loop
      pol := 'Merchants ' || act || ' ' ||
             case b when 'store-banners' then 'Store Banners'
                    when 'store-logos' then 'Store Logos'
                    else 'Product Images' end;
      execute format('drop policy if exists %I on storage.objects', pol);
    end loop;

    execute format($p$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and exists (select 1 from public.stores s
        where s.merchant_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]))$p$,
      'Merchants Upload ' || case b when 'store-banners' then 'Store Banners' when 'store-logos' then 'Store Logos' else 'Product Images' end, b);
    execute format($p$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and exists (select 1 from public.stores s
        where s.merchant_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]))$p$,
      'Merchants Update ' || case b when 'store-banners' then 'Store Banners' when 'store-logos' then 'Store Logos' else 'Product Images' end, b);
    execute format($p$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and exists (select 1 from public.stores s
        where s.merchant_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]))$p$,
      'Merchants Delete ' || case b when 'store-banners' then 'Store Banners' when 'store-logos' then 'Store Logos' else 'Product Images' end, b);
  end loop;
end $$;

update storage.buckets
set file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id in ('product-images','store-banners','store-logos','user-avatars');

-- ──────────── M6: account deletion for merchants and riders too ────────────
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
  if v_role is null or v_role::text not in ('customer','merchant','rider') then
    raise exception 'ACCOUNT_TYPE_NOT_ALLOWED';
  end if;

  if v_role::text = 'customer' and exists (
    select 1 from public.orders
    where customer_id = v_uid
      and status in ('PENDING','MERCHANT_ACCEPTED','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY')
  ) then raise exception 'ACTIVE_ORDER_EXISTS'; end if;

  if v_role::text = 'merchant' and exists (
    select 1 from public.orders o join public.stores s on s.id = o.store_id
    where s.merchant_id = v_uid
      and o.status in ('PENDING','MERCHANT_ACCEPTED','PREPARING','READY_FOR_PICKUP','RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY')
  ) then raise exception 'ACTIVE_ORDER_EXISTS'; end if;

  if v_role::text = 'rider' and exists (
    select 1 from public.delivery_assignments da join public.orders o on o.id = da.order_id
    where da.rider_id = v_uid
      and o.status in ('RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP','OUT_FOR_DELIVERY')
  ) then raise exception 'ACTIVE_ORDER_EXISTS'; end if;

  delete from public.customer_addresses where customer_id = v_uid;
  if to_regclass('public.push_tokens') is not null then
    execute 'delete from public.push_tokens where user_id = $1' using v_uid;
  end if;
  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications where user_id = $1' using v_uid;
  end if;
  if v_role::text = 'merchant' then
    update public.stores set is_open = false where merchant_id = v_uid;
  end if;

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
