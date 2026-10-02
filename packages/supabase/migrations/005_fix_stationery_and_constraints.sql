-- =============================================================================
-- MIGRATION 005: SCHEMA FIXES, CONSTRAINTS & RLS REFINEMENTS
-- Description:
--   1. Fix STATIONARY typo in store_category enum to STATIONERY
--   2. Add non-negative CHECK constraints to delivery_fee and discount_amount
--   3. Add unit_snapshot column to order_items
--   4. Refine merchant RLS policy on products to prevent DELETE (soft-delete only)
-- =============================================================================

-- 1. Rename enum value if 'STATIONARY' exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.store_category'::regtype 
    AND enumlabel = 'STATIONARY'
  ) THEN
    ALTER TYPE public.store_category RENAME VALUE 'STATIONARY' TO 'STATIONERY';
  END IF;
END $$;


-- 2. Non-negative constraints on order amounts
ALTER TABLE public.orders
  ADD CONSTRAINT check_delivery_fee_non_negative CHECK (delivery_fee >= 0),
  ADD CONSTRAINT check_discount_amount_non_negative CHECK (discount_amount >= 0);

-- 3. Add unit_snapshot column to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_snapshot VARCHAR(50);

-- 4. Replace product FOR ALL policy with explicit SELECT, INSERT, UPDATE policies
DROP POLICY IF EXISTS "Merchants manage their own products" ON public.products;

CREATE POLICY "Merchants view their own products"
  ON public.products FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Merchants insert their own products"
  ON public.products FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Merchants update their own products"
  ON public.products FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE merchant_id = auth.uid()
    )
  );
