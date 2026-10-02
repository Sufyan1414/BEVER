-- =============================================================================
-- MIGRATION 004: AUTOMATIC PROFILE CREATION TRIGGER
-- Description: Automatically creates a public.profiles record whenever a new
--              user signs up in Supabase auth.users.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  -- Extract role from user_metadata if provided, default to 'customer'
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'customer'::public.user_role;
  END;

  IF v_role IS NULL THEN
    v_role := 'customer'::public.user_role;
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    avatar_url,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop trigger if already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
