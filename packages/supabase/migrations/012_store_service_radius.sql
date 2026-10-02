-- =============================================================================
-- MIGRATION 012: STORE-SPECIFIC DELIVERY SERVICE RADIUS (FOUNDATION)
-- Description: Adds service_radius_meters column to public.stores with a
--              CHECK constraint enforcing NULL or positive values (> 0).
--
-- Data & Security Rules:
-- 1. Default value is NULL (service radius unconfigured). Existing stores remain NULL.
-- 2. CHECK constraint ensures service_radius_meters IS NULL OR service_radius_meters > 0.
-- 3. Customers retain read-only SELECT access (via "stores: public read active verified").
-- 4. No application code, RLS policies, or PostGIS RPCs are modified in this task.
-- =============================================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS service_radius_meters INTEGER DEFAULT NULL,
  ADD CONSTRAINT check_service_radius_positive CHECK (
    service_radius_meters IS NULL OR service_radius_meters > 0
  );
