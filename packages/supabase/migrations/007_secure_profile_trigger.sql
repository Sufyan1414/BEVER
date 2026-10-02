-- =============================================================================
-- MIGRATION 007: SECURE PROFILE CREATION TRIGGER (SECURITY HARDENING)
-- Description: Replaces the vulnerable handle_new_user() trigger function.
-- Security Fix: PUBLIC SIGNUPS MUST ALWAYS DEFAULT TO 'customer'.
--              raw_user_meta_data->>'role' IS SOURCED FROM CLIENT INPUT AND MUST NEVER
--              BE TRUSTED FOR ASSIGNING PRIVILEGED ROLES (admin, merchant, rider).
--
-- TRUSTED ROLE ASSIGNMENT NOTICE:
-- Admin, Merchant, and Rider profiles MUST be created or updated through an
-- authorized server-side backend / Edge Function using the Supabase Service Role key
-- or via an authenticated Admin API endpoint. Public Auth signups are strictly customers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- PUBLIC SIGNUPS: Always assign 'customer' role.
  -- Do NOT read 'role' from NEW.raw_user_meta_data as client can supply arbitrary metadata.

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
    'customer'::public.user_role,
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

-- Ensure trigger remains attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
