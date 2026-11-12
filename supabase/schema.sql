-- ==============================================================================
-- RETRACE: Production-Ready Supabase Database Schema & Row Level Security (RLS)
-- ==============================================================================
-- Execute this entire file in the Supabase Dashboard -> SQL Editor.
-- Idempotent: safe to re-run without dropping existing user data.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Independent Recovery Identity)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null check (char_length(trim(full_name)) > 0),
  recovery_id text unique not null,
  backup_phone text,
  -- Never store plaintext PINs. Only server-generated cryptographic hashes (>= 32 chars).
  recovery_pin_hash text constraint profiles_recovery_pin_hash_format check (
    recovery_pin_hash is null
    or (
      char_length(recovery_pin_hash) >= 32
      and recovery_pin_hash !~ '^[0-9]{4,12}$'
    )
  ),
  has_recovery_pin boolean default false not null,
  is_verified boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 2. DEVICES TABLE (Registered & Protected Devices)
-- ------------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null check (char_length(trim(name)) > 0),
  type text not null check (char_length(trim(type)) > 0),
  serial_ending text check (serial_ending is null or char_length(trim(serial_ending)) <= 12),
  status text default 'protected' not null check (status in ('protected', 'lost', 'recovered')),
  battery_level integer default 100 check (battery_level is null or battery_level between 0 and 100),
  is_online boolean default true not null,
  last_location_name text default 'Unknown location' not null,
  latitude double precision check (latitude is null or (latitude between -90 and 90)),
  longitude double precision check (longitude is null or (longitude between -180 and 180)),
  last_seen_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_devices_user_id on public.devices(user_id);
create index if not exists idx_devices_user_status on public.devices(user_id, status);

-- ------------------------------------------------------------------------------
-- 3. TRUSTED CONTACTS TABLE (Trusted Circle)
-- ------------------------------------------------------------------------------
create table if not exists public.trusted_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null check (char_length(trim(name)) > 0),
  relation text not null check (char_length(trim(relation)) > 0),
  phone text not null check (char_length(trim(phone)) > 0),
  email text,
  approved boolean default false not null,
  avatar_initials text not null check (char_length(trim(avatar_initials)) between 1 and 4),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_trusted_contacts_user_id on public.trusted_contacts(user_id);

-- ------------------------------------------------------------------------------
-- 4. RECOVERY REQUESTS TABLE (Incident / Recovery Sessions)
-- ------------------------------------------------------------------------------
-- Architecture Note on Trusted-Contact Approvals:
-- Anonymous (anon) users have ZERO direct access to this table.
-- When external trusted contacts approve a recovery request out-of-band,
-- approvals must be validated by a server-side endpoint using a signed,
-- single-use token and applied via server credentials (never exposed to anon).
-- ------------------------------------------------------------------------------
create table if not exists public.recovery_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete cascade not null,
  status text default 'active' not null check (status in ('active', 'recovered', 'cancelled')),
  approvals_required integer default 2 not null check (approvals_required >= 1),
  approvals_received integer default 0 not null check (approvals_received >= 0),
  approved_contact_ids uuid[] default '{}'::uuid[] not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_recovery_requests_user_status on public.recovery_requests(user_id, status);
create index if not exists idx_recovery_requests_device_id on public.recovery_requests(device_id);

-- ------------------------------------------------------------------------------
-- 5. ACTIVITY LOGS TABLE (Append-Only Audit Timeline)
-- ------------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text not null,
  category text not null check (category in ('Device', 'Security', 'Recovery')),
  created_at timestamptz default now() not null
);

create index if not exists idx_activity_logs_user_created on public.activity_logs(user_id, created_at desc);

-- ------------------------------------------------------------------------------
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

drop trigger if exists set_devices_updated_at on public.devices;
create trigger set_devices_updated_at
  before update on public.devices
  for each row execute function public.handle_updated_at();

drop trigger if exists set_trusted_contacts_updated_at on public.trusted_contacts;
create trigger set_trusted_contacts_updated_at
  before update on public.trusted_contacts
  for each row execute function public.handle_updated_at();

drop trigger if exists set_recovery_requests_updated_at on public.recovery_requests;
create trigger set_recovery_requests_updated_at
  before update on public.recovery_requests
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ------------------------------------------------------------------------------
-- Security Definer with locked-down search_path = '' and collision-resistant
-- recovery_id generation using pg_catalog.gen_random_uuid().
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_name text;
  name_prefix text;
  random_hex text;
  generated_rec_id text;
  inserted_profile_id uuid;
begin
  user_name := COALESCE(
    NULLIF(pg_catalog.btrim(new.raw_user_meta_data->>'full_name'), ''),
    NULLIF(pg_catalog.btrim(pg_catalog.split_part(COALESCE(new.email, ''), '@', 1)), ''),
    'RETRACE User'
  );

  name_prefix := pg_catalog.upper(
    pg_catalog.substr(
      pg_catalog.regexp_replace(user_name, '[^a-zA-Z0-9]', '', 'g'),
      1,
      6
    )
  );

  if name_prefix is null or name_prefix = '' then
    name_prefix := 'USER';
  end if;

  loop
    random_hex := pg_catalog.upper(
      pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        8
      )
    );
    generated_rec_id := 'RTR-' || pg_catalog.substr(random_hex, 1, 4) || '-' || pg_catalog.substr(random_hex, 5, 4) || '-' || name_prefix;
    exit when not exists (
      select 1 from public.profiles p where p.recovery_id = generated_rec_id
    );
  end loop;

  insert into public.profiles (id, full_name, recovery_id)
  values (
    new.id,
    user_name,
    generated_rec_id
  )
  on conflict (id) do nothing
  returning id into inserted_profile_id;

  if inserted_profile_id is not null then
    insert into public.activity_logs (user_id, title, description, category)
    values (
      new.id,
      'Recovery identity created',
      'Independent recovery identity ' || generated_rec_id || ' established',
      'Security'
    );
  end if;

  return new;
end;
$$;

-- Prevent direct RPC invocation by clients while allowing Supabase Auth trigger execution
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;
revoke all on function public.handle_updated_at() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & LEAST-PRIVILEGE PERMISSIONS
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.recovery_requests enable row level security;
alter table public.activity_logs enable row level security;

-- Ensure anonymous role has zero table privileges
revoke all on public.profiles from anon;
revoke all on public.devices from anon;
revoke all on public.trusted_contacts from anon;
revoke all on public.recovery_requests from anon;
revoke all on public.activity_logs from anon;

-- Grant explicit table privileges to authenticated role (enforced by RLS below)
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.devices to authenticated;
grant select, insert, update, delete on public.trusted_contacts to authenticated;
grant select, insert, update, delete on public.recovery_requests to authenticated;
grant select, insert on public.activity_logs to authenticated;

-- PROFILES Policies
drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- DEVICES Policies
drop policy if exists "Users can view their own devices" on public.devices;
create policy "Users can view their own devices"
  on public.devices for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own devices" on public.devices;
create policy "Users can insert their own devices"
  on public.devices for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own devices" on public.devices;
create policy "Users can update their own devices"
  on public.devices for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own devices" on public.devices;
create policy "Users can delete their own devices"
  on public.devices for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- TRUSTED CONTACTS Policies
drop policy if exists "Users can view their own trusted contacts" on public.trusted_contacts;
create policy "Users can view their own trusted contacts"
  on public.trusted_contacts for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own trusted contacts" on public.trusted_contacts;
create policy "Users can insert their own trusted contacts"
  on public.trusted_contacts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own trusted contacts" on public.trusted_contacts;
create policy "Users can update their own trusted contacts"
  on public.trusted_contacts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own trusted contacts" on public.trusted_contacts;
create policy "Users can delete their own trusted contacts"
  on public.trusted_contacts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- RECOVERY REQUESTS Policies
drop policy if exists "Users can view their own recovery requests" on public.recovery_requests;
create policy "Users can view their own recovery requests"
  on public.recovery_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own recovery requests" on public.recovery_requests;
create policy "Users can insert their own recovery requests"
  on public.recovery_requests for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.devices d
      where d.id = device_id
        and d.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update their own recovery requests" on public.recovery_requests;
create policy "Users can update their own recovery requests"
  on public.recovery_requests for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.devices d
      where d.id = device_id
        and d.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete their own recovery requests" on public.recovery_requests;
create policy "Users can delete their own recovery requests"
  on public.recovery_requests for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ACTIVITY LOGS Policies (Append-Only for Users)
drop policy if exists "Users can view their own activity logs" on public.activity_logs;
create policy "Users can view their own activity logs"
  on public.activity_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own activity logs" on public.activity_logs;
create policy "Users can insert their own activity logs"
  on public.activity_logs for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      device_id is null
      or exists (
        select 1 from public.devices d
        where d.id = device_id
          and d.user_id = (select auth.uid())
      )
    )
  );
