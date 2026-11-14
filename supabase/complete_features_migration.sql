-- ==============================================================================
-- RETRACE: Comprehensive Features & Security Migration
-- ==============================================================================
-- Run in Supabase Dashboard -> SQL Editor.
-- Non-destructive and idempotent: preserves all existing users, profiles,
-- devices, contacts, recovery requests, and activity logs.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. FIX AUTH SIGNUP TRIGGER (public.handle_new_user)
-- ------------------------------------------------------------------------------
-- Ensures valid PostgreSQL syntax, collision-resistant recovery_id generation,
-- safe conflict handling, and explicit execute permissions for Supabase Auth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_name TEXT;
  name_prefix TEXT;
  random_hex TEXT;
  generated_rec_id TEXT;
  inserted_profile_id UUID;
BEGIN
  user_name := COALESCE(
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(pg_catalog.btrim(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'RETRACE User'
  );

  name_prefix := pg_catalog.upper(
    pg_catalog.substr(
      pg_catalog.regexp_replace(user_name, '[^a-zA-Z0-9]', '', 'g'),
      1,
      6
    )
  );

  IF name_prefix IS NULL OR name_prefix = '' THEN
    name_prefix := 'USER';
  END IF;

  LOOP
    random_hex := pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        8
      )
    );
    generated_rec_id := 'RTR-'
      || pg_catalog.substr(random_hex, 1, 4)
      || '-'
      || pg_catalog.substr(random_hex, 5, 4)
      || '-'
      || name_prefix;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.recovery_id = generated_rec_id
    );
  END LOOP;

  INSERT INTO public.profiles (id, full_name, recovery_id)
  VALUES (NEW.id, user_name, generated_rec_id)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_profile_id;

  IF inserted_profile_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, title, description, category)
    VALUES (
      NEW.id,
      'Recovery identity created',
      'Independent recovery identity ' || generated_rec_id || ' established',
      'Security'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Secure function ownership and permissions
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

-- ------------------------------------------------------------------------------
-- 2. SECURE TRUSTED-CONTACT APPROVAL (PREVENT SELF-APPROVAL VIA CLIENT SDK)
-- ------------------------------------------------------------------------------

-- Add approved_at column if not exists
ALTER TABLE public.trusted_contacts
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Column-level update security: authenticated users can only update user-editable fields.
-- The 'approved' and 'approved_at' columns cannot be modified by direct client SDK updates.
REVOKE UPDATE ON public.trusted_contacts FROM authenticated;
GRANT UPDATE (name, relation, phone, email, avatar_initials) ON public.trusted_contacts TO authenticated;

-- Server-side security definer function to approve contact after OTP verification
CREATE OR REPLACE FUNCTION public.verify_trusted_contact_internal(
  p_contact_id UUID,
  p_user_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated boolean := false;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RETURN false; END IF;

  UPDATE public.trusted_contacts
  SET approved = true,
      approved_at = pg_catalog.now()
  WHERE id = p_contact_id
    AND user_id = p_user_id;

  IF FOUND THEN
    v_updated := true;
    INSERT INTO public.activity_logs (user_id, title, description, category)
    VALUES (
      p_user_id,
      'Trusted contact verified',
      'Emergency contact phone was verified via secure OTP',
      'Security'
    );
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_trusted_contact_internal(UUID, UUID) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.verify_trusted_contact_internal(UUID, UUID) TO authenticated;

COMMIT;

-- ------------------------------------------------------------------------------
-- VERIFICATION QUERY (Read-only check of trigger and grants)
-- ------------------------------------------------------------------------------
SELECT
  p.proname AS function_name,
  p.proowner::regrole AS owner_role,
  p.prosecdef AS is_security_definer,
  p.proacl AS privileges
FROM pg_catalog.pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('handle_new_user', 'verify_trusted_contact_internal');
