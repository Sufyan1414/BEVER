-- =============================================================================
-- MIGRATION 011: CUSTOMER ADDRESSES SINGLE-DEFAULT INTEGRITY
-- Description: Enforces database-level constraint that a customer may have at
--              most one default delivery address (is_default = TRUE).
--
-- Integrity Rule:
-- A customer can have zero or one default address (never two or more).
--
-- Security & RLS Preserved:
-- Existing RLS policies ("customer_addresses: owner reads own" and
-- "customer_addresses: owner manages own") remain untampered.
-- =============================================================================

-- Partial unique index ensuring at most one is_default = TRUE per customer_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_single_default
ON public.customer_addresses (customer_id)
WHERE is_default = TRUE;
