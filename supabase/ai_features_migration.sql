-- ==============================================================================
-- RETRACE AI: Hardened Production Capabilities Migration
-- ==============================================================================
-- Idempotent & Non-Destructive: Safe to execute in Supabase SQL Editor.
-- Architecture & Security Specifications:
-- 1. ZERO DIRECT TABLE INSERT: Direct INSERT on public.anonymous_sightings is
--    completely revoked for 'anon' and 'authenticated'. All submissions must pass
--    through the rate-limited submit_anonymous_sighting RPC.
-- 2. HARDENED SECURITY DEFINER: Sets search_path = '' to completely prevent
--    temporary-schema object substitution attacks. Schema-qualifies every ordinary function.
--    Uses standard SQL language expressions (COALESCE, NULLIF) without invalid schema prefixes.
-- 3. PER-DEVICE SERIALIZATION: Employs PostgreSQL row-level locks (FOR UPDATE)
--    on public.devices. Locks the physical device row to serialize concurrent requests,
--    guaranteeing that simultaneous submissions cannot bypass the 60-second cooldown.
-- 4. VERIFIED GPS IMMUTABILITY: Devices table coordinates and last_seen_at are
--    NEVER modified by third-party crowd sightings.
-- 5. UNIQUE BEACON TOKENS: Enforces uniqueness on devices.beacon_token using
--    a partial unique index. Uses built-in pg_catalog.gen_random_uuid() without pgcrypto dependency.
-- 6. MULTI-INCIDENT CHECKLISTS: Partial unique index on incident_id allows
--    separate checklists across multiple recovery incidents over the device lifetime.
-- 7. STRICT MULTI-TENANT RLS: panic_checklists validates user_id, device_id,
--    and incident_id ownership during both INSERT and UPDATE.
-- 8. COMPREHENSIVE INPUT VALIDATION: Validates coordinates, notes length, and accuracy
--    (including NaN, Infinity, negative values) and returns controlled error objects.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PUBLIC DISCOVERY BEACON TOKEN ON DEVICES
-- ------------------------------------------------------------------------------
alter table public.devices
  add column if not exists beacon_token text;

-- Backfill missing beacon tokens using built-in pg_catalog.gen_random_uuid().
-- Generates 64 hex characters (244 bits of cryptographic entropy) without extension dependencies.
update public.devices
set beacon_token = pg_catalog.lower(
  pg_catalog.replace(
    pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text,
    '-',
    ''
  )
)
where beacon_token is null;

-- Set secure random default for future inserts
alter table public.devices
  alter column beacon_token set default pg_catalog.lower(
    pg_catalog.replace(
      pg_catalog.gen_random_uuid()::text || pg_catalog.gen_random_uuid()::text,
      '-',
      ''
    )
  );

-- Replace old non-unique index with a strict UNIQUE index
drop index if exists public.idx_devices_beacon_token;
create unique index if not exists idx_devices_beacon_token_uniq
  on public.devices(beacon_token)
  where beacon_token is not null;

-- ------------------------------------------------------------------------------
-- 2. ANONYMOUS COMMUNITY SIGHTINGS (UNVERIFIED THIRD-PARTY LOCATIONS)
-- ------------------------------------------------------------------------------
create table if not exists public.anonymous_sightings (
  id uuid default gen_random_uuid() primary key,
  device_id uuid references public.devices(id) on delete cascade not null,
  beacon_token text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy is null or accuracy >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  reporter_agent text check (reporter_agent is null or char_length(reporter_agent) <= 100),
  reported_at timestamptz default now() not null
);

create index if not exists idx_anonymous_sightings_device_id on public.anonymous_sightings(device_id);
create index if not exists idx_anonymous_sightings_beacon_token on public.anonymous_sightings(beacon_token);
create index if not exists idx_anonymous_sightings_reported_at on public.anonymous_sightings(reported_at desc);

-- Enable Row Level Security
alter table public.anonymous_sightings enable row level security;

-- Drop all legacy or overly-permissive policies to prevent permissive OR bypass
drop policy if exists "Public can insert sightings with matching beacon token" on public.anonymous_sightings;
drop policy if exists "Enable insert for all users" on public.anonymous_sightings;
drop policy if exists "Users manage their own sightings" on public.anonymous_sightings;
drop policy if exists "Users can view sightings for their devices" on public.anonymous_sightings;
drop policy if exists "Users can delete sightings for their devices" on public.anonymous_sightings;
drop policy if exists "Allow anonymous insert" on public.anonymous_sightings;
drop policy if exists "Enable read access for all users" on public.anonymous_sightings;

-- Table Permissions: Zero direct INSERT permissions for anon or authenticated clients.
-- Sighting submissions MUST use the SECURITY DEFINER RPC below.
revoke all on table public.anonymous_sightings from public, anon;
revoke insert, update, truncate, trigger on table public.anonymous_sightings from authenticated;
grant select, delete on table public.anonymous_sightings to authenticated;
grant all on table public.anonymous_sightings to service_role;

-- SELECT Policy: Authenticated device owners can view sightings for their devices only
create policy "Users can view sightings for their devices"
  on public.anonymous_sightings
  for select
  to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = anonymous_sightings.device_id
        and d.user_id = (select auth.uid())
    )
  );

-- DELETE Policy: Authenticated device owners can purge sightings for their devices
create policy "Users can delete sightings for their devices"
  on public.anonymous_sightings
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.devices d
      where d.id = anonymous_sightings.device_id
        and d.user_id = (select auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 3. PANIC RECOVERY CHECKLISTS (INCIDENT-SPECIFIC & MULTI-TENANT HARDENED)
-- ------------------------------------------------------------------------------
create table if not exists public.panic_checklists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete cascade not null,
  incident_id uuid references public.recovery_requests(id) on delete cascade,
  completed_steps jsonb default '[]'::jsonb not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_panic_checklists_user_id on public.panic_checklists(user_id);
create index if not exists idx_panic_checklists_device_id on public.panic_checklists(device_id);

-- Drop legacy broad unique constraint if present to allow multiple historical incidents per device
drop index if exists public.idx_panic_checklists_user_device_uniq;

-- Partial Unique Index 1: Exactly one checklist per official recovery incident
create unique index if not exists idx_panic_checklists_incident_uniq
  on public.panic_checklists(incident_id)
  where incident_id is not null;

-- Partial Unique Index 2: Exactly one standalone/pre-incident checklist per user and device
create unique index if not exists idx_panic_checklists_user_device_null_incident
  on public.panic_checklists(user_id, device_id)
  where incident_id is null;

alter table public.panic_checklists enable row level security;

-- Drop all legacy policies
drop policy if exists "Users manage their own panic checklists" on public.panic_checklists;
drop policy if exists "Enable all access for authenticated users" on public.panic_checklists;
drop policy if exists "Users can view their own panic checklists" on public.panic_checklists;
drop policy if exists "Users can insert panic checklists for their own devices" on public.panic_checklists;
drop policy if exists "Users can update their own panic checklists" on public.panic_checklists;
drop policy if exists "Users can delete their own panic checklists" on public.panic_checklists;
drop policy if exists "Users can update daylight checklists" on public.panic_checklists;

-- Table Permissions
revoke all on table public.panic_checklists from public, anon;
revoke truncate, trigger on table public.panic_checklists from authenticated;
grant select, insert, update, delete on table public.panic_checklists to authenticated;
grant all on table public.panic_checklists to service_role;

-- SELECT Policy
create policy "Users can view their own panic checklists"
  on public.panic_checklists
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- INSERT Policy: Validates user ownership, device ownership, and incident ownership
create policy "Users can insert panic checklists for their own devices"
  on public.panic_checklists
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.devices d
      where d.id = panic_checklists.device_id
        and d.user_id = (select auth.uid())
    )
    and (
      incident_id is null
      or exists (
        select 1 from public.recovery_requests r
        where r.id = panic_checklists.incident_id
          and r.user_id = (select auth.uid())
      )
    )
  );

-- UPDATE Policy: Validates user ownership, device ownership, AND incident ownership
create policy "Users can update their own panic checklists"
  on public.panic_checklists
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.devices d
      where d.id = panic_checklists.device_id
        and d.user_id = (select auth.uid())
    )
    and (
      incident_id is null
      or exists (
        select 1 from public.recovery_requests r
        where r.id = panic_checklists.incident_id
          and r.user_id = (select auth.uid())
      )
    )
  );

-- DELETE Policy
create policy "Users can delete their own panic checklists"
  on public.panic_checklists
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- 4. TRUSTED CIRCLE QUORUM & MULTI-PARTY ACTIONS COLUMNS
-- ------------------------------------------------------------------------------
alter table public.recovery_requests
  add column if not exists action_quorum_approvals jsonb default '[]'::jsonb not null;

alter table public.trusted_contacts
  add column if not exists invite_token text;

create unique index if not exists idx_trusted_contacts_invite_token
  on public.trusted_contacts(invite_token)
  where invite_token is not null;

-- ------------------------------------------------------------------------------
-- 5. HARDENED SECURITY DEFINER SIGHTING RPC
-- ------------------------------------------------------------------------------
-- Security Guarantees:
-- A. SET search_path = '': Closed search path prevents temporary schema substitution.
-- B. Physical Row-Level Serialization: SELECT ... FOR UPDATE acquires an exclusive tuple
--    lock on public.devices, forcing concurrent requests targeting the same device to serialize.
-- C. Valid SQL Syntax: Uses standard bare SQL COALESCE and NULLIF constructs.
-- D. Immutability: devices.latitude, devices.longitude, and devices.last_seen_at are
--    NEVER modified by third-party crowd sightings.
-- E. Comprehensive Input Validation: Rejects NaN, Infinity, negative accuracy, out-of-range
--    coordinates, and oversized notes, returning controlled error objects.
-- F. Honest Messaging: Logs transparent unverified crowd report alert to owner activity log.
create or replace function public.submit_anonymous_sighting(
  p_beacon_token text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device record;
  v_sighting_id uuid;
  v_last_reported_at timestamptz;
  v_clean_notes text;
begin
  -- 1. Validate beacon token parameter
  if p_beacon_token is null or pg_catalog.length(pg_catalog.btrim(p_beacon_token)) < 8 or pg_catalog.length(p_beacon_token) > 128 then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Invalid beacon token parameter.'
    );
  end if;

  -- 2. Validate geographic coordinates (catches null, NaN, and Infinity)
  if p_latitude is null or p_longitude is null or
     p_latitude != p_latitude or p_longitude != p_longitude or
     p_latitude < -90.0 or p_latitude > 90.0 or
     p_longitude < -180.0 or p_longitude > 180.0 then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180 (finite numbers required).'
    );
  end if;

  -- 3. Validate accuracy parameter (catches negative, NaN, Infinity, and extreme values)
  if p_accuracy is not null and (
     p_accuracy != p_accuracy or
     p_accuracy < 0.0 or
     p_accuracy > 100000.0 or
     p_accuracy = 'Infinity'::double precision
  ) then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Invalid accuracy: must be a non-negative finite number (maximum 100,000 meters).'
    );
  end if;

  -- 4. Validate notes length (prevents unhandled check constraint exception)
  if p_notes is not null and pg_catalog.length(p_notes) > 500 then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Notes exceed the maximum allowed length of 500 characters.'
    );
  end if;

  -- 5. Lookup device with an exclusive row-level lock (FOR UPDATE)
  -- In PostgreSQL, FOR UPDATE places a physical tuple lock on the device row.
  -- This serializes concurrent requests targeting the same physical device row with ZERO collision risk.
  select id, user_id, name, status, beacon_token
  into v_device
  from public.devices
  where beacon_token = p_beacon_token
  for update;

  if v_device.id is null then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Device beacon not found.'
    );
  end if;

  -- Reject if device is not reported lost
  if v_device.status <> 'lost' then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'error', 'Device is not currently reported as lost.'
    );
  end if;

  -- 6. Atomic cooldown verification under locked serialization
  select pg_catalog.max(reported_at) into v_last_reported_at
  from public.anonymous_sightings
  where device_id = v_device.id;

  if v_last_reported_at is not null and (pg_catalog.now() - v_last_reported_at) < interval '60 seconds' then
    return pg_catalog.jsonb_build_object(
      'success', false,
      'cooldown', true,
      'error', 'Rate limit exceeded: A sighting was already reported for this device in the last 60 seconds. Please wait before submitting another report.'
    );
  end if;

  -- Standard SQL COALESCE and NULLIF expressions (not schema-qualified)
  v_clean_notes := coalesce(nullif(pg_catalog.btrim(p_notes), ''), 'Community Network Sighting');

  -- 7. Insert sighting record into anonymous_sightings ONLY
  -- CRITICAL: devices.latitude, devices.longitude, and devices.last_seen_at are NEVER modified!
  insert into public.anonymous_sightings (
    device_id,
    beacon_token,
    latitude,
    longitude,
    accuracy,
    notes,
    reported_at
  )
  values (
    v_device.id,
    p_beacon_token,
    p_latitude,
    p_longitude,
    p_accuracy,
    v_clean_notes,
    pg_catalog.now()
  )
  returning id into v_sighting_id;

  -- 8. Log unverified sighting alert into owner's activity log timeline
  insert into public.activity_logs (
    user_id,
    device_id,
    title,
    description,
    category
  )
  values (
    v_device.user_id,
    v_device.id,
    'Unverified Community Sighting Reported',
    'An anonymous good Samaritan recorded an unverified location sighting in the community network. Coordinates: [' ||
      pg_catalog.round(p_latitude::numeric, 4)::text || ', ' || pg_catalog.round(p_longitude::numeric, 4)::text || ']. This is a crowd report and has not been verified by device hardware.',
    'Recovery'
  );

  return pg_catalog.jsonb_build_object(
    'success', true,
    'verified', false,
    'sighting_id', v_sighting_id,
    'message', 'Community sighting recorded securely. Unverified location logged to device audit timeline.'
  );
end;
$$;

-- Explicit function ownership
alter function public.submit_anonymous_sighting(text, double precision, double precision, double precision, text) owner to postgres;

-- Revoke all permissions from public, grant execute to anon, authenticated, and service_role
revoke all on function public.submit_anonymous_sighting(text, double precision, double precision, double precision, text) from public;
grant execute on function public.submit_anonymous_sighting(text, double precision, double precision, double precision, text) to anon, authenticated, service_role;
