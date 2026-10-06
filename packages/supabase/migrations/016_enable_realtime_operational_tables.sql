-- 016_enable_realtime_operational_tables.sql
-- Live operational updates for customer, merchant, rider, and admin consoles.

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.delivery_assignments;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.stores;
