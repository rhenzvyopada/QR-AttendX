-- ==============================================================================
-- EXTENSIONS & UTILITIES
-- ==============================================================================
create extension if not exists pgcrypto;

-- ==============================================================================
-- TABLES
-- ==============================================================================

-- 1. Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'administrator')),
  phone text,
  address text,
  city text,
  date_of_birth date,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null unique,
  title text not null,
  venue text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Attendance
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

-- ==============================================================================
-- INDEXES (Crucial for RLS Performance)
-- ==============================================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_events_created_by on public.events(created_by);
create index if not exists idx_attendance_student_id on public.attendance(student_id);
create index if not exists idx_attendance_event_id on public.attendance(event_id);

-- ==============================================================================
-- FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 1. Helper Function: Safely check if the current user is an admin.
-- (Fixes the infinite recursion bug in RLS policies)
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'administrator'
  );
$$;

-- 2. Automatically update the `updated_at` column on events
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at
  before update on public.events
  for each row execute procedure public.handle_updated_at();

-- 3. SECURITY: Prevent users from promoting themselves to Administrator
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.role <> new.role then
    if not exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'administrator'
    ) then
      new.role = old.role; -- Revert if not an admin
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation_trigger on public.profiles;
create trigger prevent_role_escalation_trigger
  before update on public.profiles
  for each row execute procedure public.prevent_role_escalation();

-- 4. AUTH: Create a profile row automatically when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('student', 'teacher', 'administrator')
        then new.raw_user_meta_data ->> 'role'
      else 'student'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

-- ------------------------------------------------------------------------------
-- RLS: PROFILES
-- ------------------------------------------------------------------------------

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees" on public.profiles
  for select using (
    exists (
      select 1 from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id and e.created_by = auth.uid()
    )
  );

-- ADMIN: View, Update, Delete any profile
drop policy if exists "Administrators can view all profiles" on public.profiles;
create policy "Administrators can view all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Administrators can update any profile" on public.profiles;
create policy "Administrators can update any profile" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Administrators can delete profiles" on public.profiles;
create policy "Administrators can delete profiles" on public.profiles
  for delete using (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: EVENTS
-- ------------------------------------------------------------------------------

drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user" on public.events
  for select using (auth.role() = 'authenticated');

drop policy if exists "Users can insert events" on public.events;
create policy "Users can insert events" on public.events
  for insert with check (
    auth.uid() = created_by
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

drop policy if exists "Users can update their own events" on public.events;
create policy "Users can update their own events" on public.events
  for update using (
    auth.uid() = created_by
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
    and status = 'open'
  )
  with check (auth.uid() = created_by);

-- ADMIN: Full CRUD on Events
drop policy if exists "Administrators can view all events" on public.events;
create policy "Administrators can view all events" on public.events
  for select using (public.is_admin());

drop policy if exists "Administrators can create events" on public.events;
create policy "Administrators can create events" on public.events
  for insert with check (public.is_admin());

drop policy if exists "Administrators can update events" on public.events;
create policy "Administrators can update events" on public.events
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Administrators can delete events" on public.events;
create policy "Administrators can delete events" on public.events
  for delete using (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: ATTENDANCE
-- ------------------------------------------------------------------------------

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance" on public.attendance
  for select using (auth.uid() = student_id);

drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance" on public.attendance
  for insert with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.events e
      where e.id = attendance.event_id and e.status = 'open'
    )
  );

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events" on public.attendance
  for select using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id and e.created_by = auth.uid()
    )
  );

-- ADMIN: Full CRUD on Attendance
drop policy if exists "Administrators can view all attendance" on public.attendance;
create policy "Administrators can view all attendance" on public.attendance
  for select using (public.is_admin());

drop policy if exists "Administrators can insert attendance" on public.attendance;
create policy "Administrators can insert attendance" on public.attendance
  for insert with check (public.is_admin());

drop policy if exists "Administrators can update attendance" on public.attendance;
create policy "Administrators can update attendance" on public.attendance
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Administrators can delete attendance" on public.attendance;
create policy "Administrators can delete attendance" on public.attendance
  for delete using (public.is_admin());

-- ==============================================================================
-- POSTGRES / POSTGREST CACHE RELOAD
-- ==============================================================================
notify pgrst, 'reload schema';

-- ==============================================================================
-- ACCOUNT REPAIR: BACKFILL MISSING PROFILES
-- ==============================================================================
-- Ensures any missing user from auth.users gets a profile row. 
-- Crucial for finding existing accounts.
insert into public.profiles (id, email, full_name, role, created_at, updated_at)
select
  u.id,
  u.email,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  case
    when u.raw_user_meta_data ->> 'role' in ('student', 'teacher', 'administrator')
      then u.raw_user_meta_data ->> 'role'
    else 'student'
  end,
  now(),
  now()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);