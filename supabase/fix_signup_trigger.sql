-- ==============================================================================
-- RETRACE: Non-Destructive Signup Trigger & Permission Fix
-- ==============================================================================
-- Run in Supabase Dashboard -> SQL Editor.
-- Safe for production: does NOT delete users, does NOT reset tables, and does
-- NOT overwrite existing profiles or activity logs.
-- ==============================================================================

BEGIN;

-- 1. Ensure public.handle_new_user() uses valid PostgreSQL syntax,
--    collision-resistant recovery_id generation, and idempotent profile insert.
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

-- 2. Lock down client RPC execution while explicitly allowing Supabase Auth
--    (supabase_auth_admin) to use schema public and execute the trigger.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

COMMIT;

-- 4. Safe read-only verification (verify function owner, security definer, and trigger)
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled_state,
  p.proowner::regrole AS function_owner,
  p.prosecdef AS security_definer
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'auth.users'::regclass
  AND NOT t.tgisinternal;

