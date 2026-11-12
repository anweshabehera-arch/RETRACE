-- ==============================================================================
-- RETRACE: Fix Signup Trigger Function & Backfill Missing User Profiles
-- ==============================================================================
-- Run this in Supabase Dashboard -> SQL Editor AFTER public.profiles and
-- public.activity_logs have been created by supabase/schema.sql.
--
-- Execution Order inside this transaction:
--   1. Replace public.handle_new_user() with valid PostgreSQL COALESCE/NULLIF
--      syntax, locked search_path = '', and collision-resistant recovery_id.
--   2. Re-apply function execute revocations and attach on_auth_user_created.
--   3. Backfill missing public.profiles and initial activity_logs rows for
--      existing auth.users accounts without duplicating existing records.
--   4. Return a non-sensitive verification summary of public.profiles.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- STEP 1: Fix public.handle_new_user() Signup Trigger Function
-- ------------------------------------------------------------------------------
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
BEGIN
  user_name := COALESCE(
    NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(pg_catalog.btrim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
    'RETRACE User'
  );

  name_prefix := pg_catalog.upper(
    pg_catalog.substr(
      pg_catalog.regexp_replace(user_name, '[^a-zA-Z0-9]', '', 'g'),
      1,
      6
    )
  );

  IF name_prefix = '' THEN
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
  VALUES (
    NEW.id,
    user_name,
    generated_rec_id
  );

  INSERT INTO public.activity_logs (user_id, title, description, category)
  VALUES (
    NEW.id,
    'Recovery identity created',
    'Independent recovery identity ' || generated_rec_id || ' established',
    'Security'
  );

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- STEP 2: Re-apply Security Revocations & Ensure Auth Trigger is Attached
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- STEP 3: Safe, Idempotent Profile Backfill for Existing Auth Users
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  u RECORD;
  user_name TEXT;
  name_prefix TEXT;
  random_hex TEXT;
  generated_rec_id TEXT;
  inserted_profile_id UUID;
BEGIN
  FOR u IN
    SELECT
      au.id,
      au.email,
      au.raw_user_meta_data->>'full_name' AS meta_full_name
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = au.id
    )
  LOOP
    user_name := COALESCE(
      NULLIF(pg_catalog.btrim(u.meta_full_name), ''),
      NULLIF(pg_catalog.btrim(pg_catalog.split_part(u.email, '@', 1)), ''),
      'RETRACE User'
    );

    name_prefix := pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.regexp_replace(user_name, '[^a-zA-Z0-9]', '', 'g'),
        1,
        6
      )
    );

    IF name_prefix = '' THEN
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

    inserted_profile_id := NULL;

    INSERT INTO public.profiles (id, full_name, recovery_id)
    VALUES (u.id, user_name, generated_rec_id)
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO inserted_profile_id;

    IF inserted_profile_id IS NOT NULL THEN
      INSERT INTO public.activity_logs (user_id, title, description, category)
      VALUES (
        u.id,
        'Recovery identity created',
        'Independent recovery identity ' || generated_rec_id || ' established',
        'Security'
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- ------------------------------------------------------------------------------
-- STEP 4: Safe Verification Query (Non-sensitive columns only)
-- ------------------------------------------------------------------------------
SELECT
  id,
  full_name,
  recovery_id,
  has_recovery_pin,
  is_verified,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

