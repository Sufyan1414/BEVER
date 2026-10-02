-- =============================================================================
-- MIGRATION 009: GUARDED STORE CATEGORY ENUM RECOVERY
-- Description: Ensures store_category contains 'STATIONERY' regardless of migration history.
-- =============================================================================

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
