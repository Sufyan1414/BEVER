-- 038: customer taste profile, meal baskets (bundles) and notifications.
-- Safe to re-run.

-- ── 1. Meal baskets: a shop's ready-made combo of products (breakfast, snacks, dinner) ──────────
create table if not exists public.bundles (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  slot        text not null default 'ANYTIME' check (slot in ('BREAKFAST', 'SNACKS', 'DINNER', 'ANYTIME')),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.bundle_items (
  bundle_id  uuid not null references public.bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity   integer not null default 1 check (quantity between 1 and 20),
  primary key (bundle_id, product_id)
);
create index if not exists idx_bundles_store on public.bundles(store_id) where is_active;
create index if not exists idx_bundle_items_product on public.bundle_items(product_id);

alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;

drop policy if exists "bundles: public read active" on public.bundles;
create policy "bundles: public read active" on public.bundles for select
  using (is_active and exists (select 1 from public.stores s where s.id = store_id and s.is_active and s.is_verified));
drop policy if exists "bundles: merchant manages own" on public.bundles;
create policy "bundles: merchant manages own" on public.bundles for all
  using (exists (select 1 from public.stores s where s.id = store_id and s.merchant_id = (select auth.uid())))
  with check (exists (select 1 from public.stores s where s.id = store_id and s.merchant_id = (select auth.uid())));

drop policy if exists "bundle_items: public read" on public.bundle_items;
create policy "bundle_items: public read" on public.bundle_items for select
  using (exists (select 1 from public.bundles b join public.stores s on s.id = b.store_id
                 where b.id = bundle_id and b.is_active and s.is_active and s.is_verified));
drop policy if exists "bundle_items: merchant manages own" on public.bundle_items;
create policy "bundle_items: merchant manages own" on public.bundle_items for all
  using (exists (select 1 from public.bundles b join public.stores s on s.id = b.store_id
                 where b.id = bundle_id and s.merchant_id = (select auth.uid())))
  with check (exists (select 1 from public.bundles b join public.stores s on s.id = b.store_id
                      where b.id = bundle_id and s.merchant_id = (select auth.uid())));

-- ── 2. Customer taste profile: what THIS customer buys, and when ───────────────────────────────
create or replace function public.get_my_taste(p_tz text default 'Asia/Kolkata')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select o.id, o.created_at, extract(hour from (o.created_at at time zone p_tz))::int as hr
      from public.orders o
     where o.customer_id = (select auth.uid())
       and o.status::text not in ('CANCELLED', 'REJECTED', 'EXPIRED')
  ),
  hours as (
    select h, coalesce(c.n, 0) as n
      from generate_series(0, 23) h
      left join (select hr, count(*) n from mine group by hr) c on c.hr = h
  ),
  top as (
    select oi.product_id, p.name, p.image_url, p.store_id, p.price, sum(oi.quantity)::int as qty
      from public.order_items oi
      join mine m on m.id = oi.order_id
      join public.products p on p.id = oi.product_id and p.is_available and p.is_active
     group by oi.product_id, p.name, p.image_url, p.store_id, p.price
     order by qty desc, max(m.created_at) desc
     limit 8
  )
  select jsonb_build_object(
    'orders', (select count(*) from mine),
    'last_order_at', (select max(created_at) from mine),
    'hours', (select jsonb_agg(n order by h) from hours),
    'morning_orders', (select count(*) from mine where hr between 5 and 11),
    'top_products', coalesce((select jsonb_agg(to_jsonb(t)) from top t), '[]'::jsonb)
  );
$$;
revoke execute on function public.get_my_taste(text) from public, anon;
grant execute on function public.get_my_taste(text) to authenticated;

-- ── 3. Smart baskets: build Breakfast / Snacks / Dinner baskets from each shop's own products ──
-- Run once (and again any time): select public.generate_smart_bundles();
create or replace function public.generate_smart_bundles()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store record;
  v_def record;
  v_bundle uuid;
  v_ids uuid[];
  v_made integer := 0;
begin
  for v_store in select id from public.stores where is_active loop
    for v_def in
      select * from (values
        ('BREAKFAST', 'Breakfast basket', 'Start the day right: the essentials for a quick breakfast.',
          array['milk','bread','egg','butter','tea','coffee','poha','oats','corn','jam','banana','biscuit','paneer','curd']),
        ('SNACKS', 'Snack time combo', 'Something crunchy and something cold for the evening.',
          array['chips','namkeen','biscuit','cola','juice','chocolate','cookie','popcorn','mixture','nuts','almond']),
        ('DINNER', 'Dinner basket', 'The basics for a home-cooked dinner tonight.',
          array['atta','rice','dal','oil','salt','onion','potato','tomato','masala','paneer','ghee','sugar'])
      ) as t(slot, name, descr, words)
    loop
      if exists (select 1 from public.bundles where store_id = v_store.id and slot = v_def.slot and name = v_def.name) then
        continue;
      end if;
      -- at most one product per keyword, up to 5 products, only those in stock
      select array_agg(id) into v_ids from (
        select distinct on (w) p.id
          from unnest(v_def.words) as w
          join public.products p on p.store_id = v_store.id and p.is_available and p.is_active and p.name ilike '%' || w || '%'
         order by w, p.price
         limit 5
      ) x;
      if coalesce(cardinality(v_ids), 0) >= 3 then
        insert into public.bundles(store_id, slot, name, description) values (v_store.id, v_def.slot, v_def.name, v_def.descr) returning id into v_bundle;
        insert into public.bundle_items(bundle_id, product_id) select v_bundle, unnest(v_ids) on conflict do nothing;
        v_made := v_made + 1;
      end if;
    end loop;
  end loop;
  return 'Created ' || v_made || ' baskets';
end;
$$;
revoke all on function public.generate_smart_bundles() from public, anon, authenticated;

-- ── 4. Notifications inbox + device tokens (tokens are for real push once Firebase is connected) ─
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "notifications: own read" on public.notifications;
create policy "notifications: own read" on public.notifications for select using (user_id = (select auth.uid()));
drop policy if exists "notifications: own update" on public.notifications;
create policy "notifications: own update" on public.notifications for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'android',
  app        text not null default 'customer',
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens: own all" on public.push_tokens;
create policy "push_tokens: own all" on public.push_tokens for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Build the baskets right now for existing shops.
select public.generate_smart_bundles();
