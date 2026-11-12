-- ==============================================================================
-- RETRACE: Read-Only Signup Trigger & Schema Diagnostics
-- ==============================================================================
-- Run in Supabase Dashboard -> SQL Editor to inspect the live database objects
-- involved when Supabase Auth inserts a new user into auth.users.
-- Contains ZERO writes, ZERO deletes, and ZERO secrets.
-- ==============================================================================

-- 1. All custom triggers attached to auth.users (check for old/duplicate triggers)
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled_state,
  pg_catalog.pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_catalog.pg_trigger t
WHERE t.tgrelid = 'auth.users'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2. Live definition, owner, security definer, and search_path of handle_new_user()
SELECT
  p.proname AS function_name,
  p.proowner::regrole AS owner_role,
  p.prosecdef AS is_security_definer,
  p.proconfig AS function_config,
  p.proacl AS function_privileges,
  pg_catalog.pg_get_functiondef(p.oid) AS full_definition
FROM pg_catalog.pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'handle_new_user';

-- 3. Columns, nullability, and defaults on public.profiles and public.activity_logs
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('profiles', 'activity_logs')
ORDER BY c.table_name, c.ordinal_position;

-- 4. Constraints and RLS status on public.profiles and public.activity_logs
SELECT
  cls.relname AS table_name,
  cls.relrowsecurity AS rls_enabled,
  cls.relforcerowsecurity AS force_rls
FROM pg_catalog.pg_class cls
WHERE cls.relnamespace = 'public'::regnamespace
  AND cls.relname IN ('profiles', 'activity_logs');

SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'activity_logs')
ORDER BY tablename, policyname;

