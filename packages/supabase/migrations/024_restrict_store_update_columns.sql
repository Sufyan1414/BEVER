-- Merchants may only edit safe columns of their own store (name, phone, open/closed).
-- Blocks self-verification (is_verified), moving the store, changing radius/minimum/merchant_id.
revoke update on public.stores from authenticated, anon;
grant update (name, phone, is_open) on public.stores to authenticated;
