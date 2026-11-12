-- ==============================================================================
-- RETRACE: Safe, Idempotent Profile Backfill for Pre-Migration Auth Users
-- ==============================================================================
-- Run this in Supabase Dashboard -> SQL Editor AFTER executing supabase/schema.sql.
-- Creates missing rows in public.profiles (and initial activity_logs entry) for
-- existing auth.users accounts created before the on_auth_user_created trigger
-- was active. Never reads passwords, tokens, or secrets.
-- ==============================================================================

BEGIN;

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

-- Safe verification query (returns only non-sensitive profile summary)
SELECT
  id,
  full_name,
  recovery_id,
  has_recovery_pin,
  is_verified,
  created_at
FROM public.profiles
ORDER BY created_at DESC;
