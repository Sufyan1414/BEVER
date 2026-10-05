-- =============================================================================
-- MIGRATION 014: ENSURE PROFILE RPC
-- Description: Creates a SECURITY DEFINER function that guarantees a
--              public.profiles row exists for the currently authenticated user.
--
-- WHY THIS IS NEEDED:
--   The on_auth_user_created trigger (migrations 004 & 007) creates a profile
--   row automatically for new signups. However, users who signed up in
--   auth.users BEFORE those migrations were applied have no profile row.
--   This function handles that gap in a safe, server-side way.
--
-- SECURITY MODEL:
--   - SECURITY DEFINER: runs with the owner's privileges (postgres).
--   - Uses auth.uid() internally — the caller cannot supply a different user ID.
--   - Only ever inserts for the calling user's own auth.uid().
--   - ON CONFLICT DO NOTHING: idempotent and race-condition safe.
--   - REVOKE from PUBLIC; grant only to authenticated.
--
-- BEHAVIOUR:
--   1. If a profile row already exists, returns it immediately.
--   2. If no row exists, creates a minimal row from auth.users metadata,
--      then returns the newly created row.
--   3. full_name is intentionally left empty ('') so the app's
--      ProfileSetup screen prompts the user to provide it.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_phone   TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'invalid_authorization_specification';
  END IF;

  -- Fast path: profile already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
    RETURN QUERY SELECT * FROM public.profiles WHERE id = v_user_id;
    RETURN;
  END IF;

  -- Slow path: user pre-dates the trigger — create a minimal profile row.
  -- Phone is read from auth.users so it matches what was supplied at signup.
  SELECT COALESCE(au.phone, au.raw_user_meta_data->>'phone', '')
  INTO   v_phone
  FROM   auth.users au
  WHERE  au.id = v_user_id;

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'customer'::public.user_role,
    '',                          -- empty: ProfileSetup will collect the real name
    COALESCE(v_phone, ''),
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;   -- safe against race conditions

  RETURN QUERY SELECT * FROM public.profiles WHERE id = v_user_id;
END;
$$;

-- Revoke default PUBLIC execute grant; grant only to authenticated users
REVOKE EXECUTE ON FUNCTION public.ensure_my_profile() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;
