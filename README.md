# QR AttendX

A QR-code based school attendance app built with Expo Router, React Native, and Supabase.

## Features

- Email/password authentication
- Student and Teacher account types (selected at sign-up and shown in **Profile**)
- QR code generation for events (teachers) and check-in scanning (students)
- Attendance history for students and per-event attendance for teachers

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from the example and add your Supabase project values:

   ```bash
   copy .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Apply the database schema. In the Supabase dashboard open **SQL Editor**, paste the
   contents of [`supabase/schema.sql`](./supabase/schema.sql), and run it. This creates or
   updates the `profiles`, `events`, and `attendance` tables, row level security policies,
   and the trigger that creates a profile row for every new user.

   > If you previously signed up before running the schema, run this once in the SQL
   > Editor so existing accounts get a profile row:
   >
   > ```sql
   > insert into public.profiles (id, email, full_name, role)
   > select
   >   u.id,
   >   u.email,
   >   nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
   >   case
   >     when u.raw_user_meta_data ->> 'role' in ('student', 'teacher', 'administrator')
   >       then u.raw_user_meta_data ->> 'role'
   >     else 'student'
   >   end
   > from auth.users u
   > on conflict (id) do nothing;
   > ```

4. Start the app:

   ```bash
   npm run start
   ```

## Notes

- **Security — re-run the schema after updating.** The attendance insert policy
  now requires the target event to exist and be `open`, and the app validates
  the check-in window against the event row in the database (not against values
  embedded in the QR payload). If you applied an older version of
  `supabase/schema.sql`, paste and run the file again — it is safe to re-run.
- The **Profile** screen lets you change your display name, phone number, street
  address, city, date of birth, and emergency contact. Your **Account type**
  (Student / Teacher) is shown as read-only and is selected at sign-up. Profile
  data is stored in the `public.profiles` table.
- If you already applied an older schema, run the updated `supabase/schema.sql` again
  to add the five personal-information columns. Before the schema is applied, the app
  keeps profile information in auth user metadata. Running the schema (step 3) enables
  the full database-backed experience, including events and attendance.

## Troubleshooting

### "Could not find the table 'public.<name>' in the schema cache"

This error means the database tables do not exist yet. Fix it by running the schema:

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** → **New query**.
3. Paste everything from [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
4. If the tables are still reported as missing, refresh PostgREST's cache:

   ```sql
   notify pgrst, 'reload schema';
   ```

Creating events (teacher) and scanning a QR code (student) both require the `events`
and `attendance` tables, so the schema must be applied before those features work.

### `new row violates row-level security policy for table "events"`

The `events` insert policy only allows **teacher** accounts, and it checks for a
matching row in `public.profiles`:

```sql
create policy "Users can insert events" on public.events
  for insert with check (
    auth.uid() = created_by
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'teacher')
  );
```

Accounts that signed up **before** the schema was applied have no profile row, so
that check fails. The app recreates the missing row automatically from your auth
metadata when it opens (see `ensureProfile` in `lib/profiles.ts`), but you can also
backfill it once in the SQL Editor:

```sql
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  case
    when u.raw_user_meta_data ->> 'role' in ('student', 'teacher', 'administrator')
      then u.raw_user_meta_data ->> 'role'
    else 'student'
  end
from auth.users u
on conflict (id) do nothing;
```

Make sure your account's **Account type** is set to **Teacher** on the Profile screen.

