-- Ratings for delivered orders + earnings/sales summaries.

create table if not exists public.order_ratings (
  order_id uuid primary key references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  store_rating smallint not null check (store_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
alter table public.order_ratings enable row level security;
drop policy if exists "ratings: customer reads own" on public.order_ratings;
create policy "ratings: customer reads own" on public.order_ratings
  for select to authenticated using (customer_id = (select auth.uid()));

create or replace function public.rate_order(p_order_id uuid, p_rating integer, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_order public.orders;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'INVALID_RATING'; end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.customer_id <> v_uid then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'DELIVERED' then raise exception 'ORDER_NOT_DELIVERED'; end if;
  insert into public.order_ratings(order_id, customer_id, store_id, store_rating, comment)
  values (p_order_id, v_uid, v_order.store_id, p_rating, nullif(trim(p_comment), ''))
  on conflict (order_id) do nothing;
  if not found then return; end if;
  update public.stores s set
    total_ratings = (select count(*) from public.order_ratings r where r.store_id = s.id),
    average_rating = (select round(avg(r.store_rating)::numeric, 2) from public.order_ratings r where r.store_id = s.id)
  where s.id = v_order.store_id;
end $$;
revoke execute on function public.rate_order(uuid, integer, text) from public, anon;
grant execute on function public.rate_order(uuid, integer, text) to authenticated;

create or replace function public.my_order_rating(p_order_id uuid)
returns smallint language sql security definer set search_path = '' stable as $$
  select store_rating from public.order_ratings
  where order_id = p_order_id and customer_id = (select auth.uid());
$$;
revoke execute on function public.my_order_rating(uuid) from public, anon;
grant execute on function public.my_order_rating(uuid) to authenticated;

-- Merchant: sales for own store (paise). Cancelled/rejected excluded.
create or replace function public.merchant_sales_summary()
returns table(today_orders integer, today_revenue integer, week_orders integer, week_revenue integer, pending_orders integer)
language sql security definer set search_path = '' stable as $$
  select
    count(*) filter (where o.status = 'DELIVERED' and o.created_at >= date_trunc('day', now()))::integer,
    coalesce(sum(o.items_total) filter (where o.status = 'DELIVERED' and o.created_at >= date_trunc('day', now())), 0)::integer,
    count(*) filter (where o.status = 'DELIVERED' and o.created_at >= now() - interval '7 days')::integer,
    coalesce(sum(o.items_total) filter (where o.status = 'DELIVERED' and o.created_at >= now() - interval '7 days'), 0)::integer,
    count(*) filter (where o.status = 'PENDING')::integer
  from public.orders o
  join public.stores s on s.id = o.store_id
  where s.merchant_id = (select auth.uid());
$$;
revoke execute on function public.merchant_sales_summary() from public, anon;
grant execute on function public.merchant_sales_summary() to authenticated;

-- Rider: estimated payout = max(delivery fee, Rs 25) per delivered order.
create or replace function public.rider_earnings_summary()
returns table(today_deliveries integer, today_earnings integer, week_deliveries integer, week_earnings integer)
language sql security definer set search_path = '' stable as $$
  select
    count(*) filter (where da.delivered_at >= date_trunc('day', now()))::integer,
    coalesce(sum(greatest(o.delivery_fee, 2500)) filter (where da.delivered_at >= date_trunc('day', now())), 0)::integer,
    count(*) filter (where da.delivered_at >= now() - interval '7 days')::integer,
    coalesce(sum(greatest(o.delivery_fee, 2500)) filter (where da.delivered_at >= now() - interval '7 days'), 0)::integer
  from public.delivery_assignments da
  join public.orders o on o.id = da.order_id
  where da.rider_id = (select auth.uid()) and da.delivered_at is not null;
$$;
revoke execute on function public.rider_earnings_summary() from public, anon;
grant execute on function public.rider_earnings_summary() to authenticated;
