-- ==============================================================================
-- RETRACE: Supabase Database Schema & Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Independent Recovery Identity)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  recovery_id text unique not null,
  backup_phone text,
  recovery_pin_hash text,
  is_verified boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 2. DEVICES TABLE (Registered & Protected Devices)
-- ------------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  type text not null, -- e.g., 'iPhone', 'MacBook', 'Android', 'iPad'
  serial_ending text,
  status text default 'protected' not null check (status in ('protected', 'lost', 'recovered')),
  battery_level integer default 100 check (battery_level between 0 and 100),
  is_online boolean default true not null,
  last_location_name text default 'Unknown location',
  latitude double precision,
  longitude double precision,
  last_seen_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 3. TRUSTED CONTACTS TABLE (Trusted Circle)
-- ------------------------------------------------------------------------------
create table if not exists public.trusted_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  relation text not null, -- e.g., 'Sister', 'Friend', 'Parent'
  phone text not null,
  approved boolean default false not null,
  avatar_initials text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 4. RECOVERY REQUESTS TABLE (Incident / Recovery Sessions)
-- ------------------------------------------------------------------------------
create table if not exists public.recovery_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id uuid references public.devices(id) on delete cascade not null,
  status text default 'active' not null check (status in ('active', 'recovered', 'cancelled')),
  approvals_required integer default 2 not null,
  approvals_received integer default 0 not null,
  notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- 5. ACTIVITY LOGS TABLE (Transparent Audit Timeline)
-- ------------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text not null,
  category text not null check (category in ('Device', 'Security', 'Recovery')),
  created_at timestamptz default now() not null
);

-- ------------------------------------------------------------------------------
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create or replace trigger set_devices_updated_at
  before update on public.devices
  for each row execute function public.handle_updated_at();

create or replace trigger set_trusted_contacts_updated_at
  before update on public.trusted_contacts
  for each row execute function public.handle_updated_at();

create or replace trigger set_recovery_requests_updated_at
  before update on public.recovery_requests
  for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_name text;
  generated_rec_id text;
begin
  user_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  generated_rec_id := 'RTR-' || floor(1000 + random() * 9000)::text || '-' || upper(regexp_replace(user_name, '[^a-zA-Z0-9]', '', 'g'));

  insert into public.profiles (id, full_name, recovery_id, backup_phone)
  values (
    new.id,
    user_name,
    generated_rec_id,
    new.raw_user_meta_data->>'backup_phone'
  );

  -- Log initial registration activity
  insert into public.activity_logs (user_id, title, description, category)
  values (
    new.id,
    'Recovery identity created',
    'Independent recovery identity ' || generated_rec_id || ' established',
    'Security'
  );

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.trusted_contacts enable row level security;
alter table public.recovery_requests enable row level security;
alter table public.activity_logs enable row level security;

-- PROFILES Policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- DEVICES Policies
create policy "Users can view their own devices"
  on public.devices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own devices"
  on public.devices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own devices"
  on public.devices for update
  using (auth.uid() = user_id);

create policy "Users can delete their own devices"
  on public.devices for delete
  using (auth.uid() = user_id);

-- TRUSTED CONTACTS Policies
create policy "Users can view their own trusted contacts"
  on public.trusted_contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own trusted contacts"
  on public.trusted_contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own trusted contacts"
  on public.trusted_contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own trusted contacts"
  on public.trusted_contacts for delete
  using (auth.uid() = user_id);

-- RECOVERY REQUESTS Policies
create policy "Users can view their own recovery requests"
  on public.recovery_requests for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recovery requests"
  on public.recovery_requests for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own recovery requests"
  on public.recovery_requests for update
  using (auth.uid() = user_id);

-- ACTIVITY LOGS Policies
create policy "Users can view their own activity logs"
  on public.activity_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own activity logs"
  on public.activity_logs for insert
  with check (auth.uid() = user_id);

