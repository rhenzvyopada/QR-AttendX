create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'administrator')),
  phone text,
  address text,
  city text,
  date_of_birth text,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists date_of_birth text;
alter table public.profiles add column if not exists emergency_contact text;

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

-- Add the richer event fields for databases created before they existed.
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists description text;


create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  scanned_at timestamptz not null default now(),
  unique (student_id, event_id)
);

-- Keep event `updated_at` in sync when an event row changes.
create or replace function public.loosen_event_updated_at()
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
  for each row
  execute procedure public.loosen_event_updated_at();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;

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
  )
  with check (auth.uid() = created_by);

drop policy if exists "Students can view their own attendance" on public.attendance;
create policy "Students can view their own attendance" on public.attendance
  for select using (auth.uid() = student_id);

-- Students may register their own attendance, but only for events that exist
-- and are still open. The server-side check prevents a tampered client from
-- inserting attendance rows for closed or non-existent events.
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

-- Administrators can view all events and manage (create/update/close/delete)
-- events in the whole system.
drop policy if exists "Administrators can view all events" on public.events;
create policy "Administrators can view all events" on public.events
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

drop policy if exists "Administrators can create events" on public.events;
create policy "Administrators can create events" on public.events
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

drop policy if exists "Administrators can update events" on public.events;
create policy "Administrators can update events" on public.events
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

drop policy if exists "Administrators can close events" on public.events;
create policy "Administrators can close events" on public.events
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

drop policy if exists "Administrators can delete events" on public.events;
create policy "Administrators can delete events" on public.events
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Administrators can view attendance records across the whole system, including
-- attendance for events they did not create.
drop policy if exists "Administrators can view all attendance" on public.attendance;
create policy "Administrators can view all attendance" on public.attendance
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Administrators can insert attendance.
drop policy if exists "Administrators can insert attendance" on public.attendance;
create policy "Administrators can insert attendance" on public.attendance
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Administrators can correct attendance records (e.g. fix a wrong scan time).
drop policy if exists "Administrators can update attendance" on public.attendance;
create policy "Administrators can update attendance" on public.attendance
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Administrators can remove erroneous attendance records.
drop policy if exists "Administrators can delete attendance" on public.attendance;
create policy "Administrators can delete attendance" on public.attendance
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Students can only view and insert their own attendance, and only into
-- events that exist and are open (see the insert policy below).
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

-- Teachers can view attendance for events they created.
drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events" on public.attendance
  for select using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id and e.created_by = auth.uid()
    )
  );

-- Users (any authenticated role) can view their own profile and update it.
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id);

-- Teachers can view the profiles of students that have attended their events,
-- so they can map attendance to a person while staying within role-based
-- boundaries.
drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
create policy "Teachers can view profiles of their attendees" on public.profiles
  for select using (
    exists (
      select 1 from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = profiles.id and e.created_by = auth.uid()
    )
  );

-- Administrators can view profiles of all users (user management).
drop policy if exists "Administrators can view all profiles" on public.profiles;
create policy "Administrators can view all profiles" on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Administrators can update roles when managing users.
drop policy if exists "Administrators can update any profile" on public.profiles;
create policy "Administrators can update any profile" on public.profiles
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'administrator'
    )
  );

-- Refresh PostgREST's schema cache so the new tables/columns are immediately
-- visible to the API. Safe to run repeatedly.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Account repair: backfill missing profile rows.
--
-- Accounts that signed up before this schema (and its on_auth_user_created
-- trigger) was applied have no public.profiles row, so their chosen account
-- type is invisible to the app and to the RLS policies. This inserts a row for
-- every auth user that is missing one, using the role/name they chose at
-- sign-up (stored in raw_user_meta_data). It never touches rows that already
-- exist, so an administrator's later role changes are preserved. Safe to run
-- repeatedly.
-- ---------------------------------------------------------------------------
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

