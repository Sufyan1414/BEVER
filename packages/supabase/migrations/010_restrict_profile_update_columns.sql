-- =============================================================================
-- MIGRATION 010: RESTRICT CUSTOMER PROFILE UPDATE COLUMNS
-- Description: Restricts UPDATE privileges on public.profiles for the
--              authenticated role to ONLY the full_name column.
--
-- Security Enforcement:
-- 1. REVOKE table-level UPDATE on profiles from authenticated and anon.
-- 2. GRANT column-level UPDATE ONLY on (full_name) to authenticated.
-- 3. All other columns (id, role, phone, avatar_url, fcm_token, is_active,
--    created_at, updated_at) are BLOCKED from client-initiated UPDATE requests.
-- 4. Preserves RLS policies and server-side triggers (profiles_updated_at).
-- =============================================================================

-- Revoke table-level UPDATE permissions from public API roles
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Grant column-level UPDATE privilege ONLY on full_name to authenticated role
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- Ensure SELECT privilege on public.profiles is granted to authenticated role
GRANT SELECT ON public.profiles TO authenticated;

-- Confirm Row Level Security remains active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
