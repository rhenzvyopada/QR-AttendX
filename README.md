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

## Running on an Android phone

The app is a native Expo/React Native app and runs on Android. Two options:

### Option A — Expo Go (fastest, no build needed)

1. Install **Expo Go** from the Play Store on your phone.
2. Make sure the phone and computer are on the same Wi-Fi network.
3. Start the dev server:

   ```bash
   npm run start
   ```

4. Scan the QR code shown in the terminal with the Expo Go app, or run
   `npm run android` if you have an emulator/Android Studio connected.

   > Camera scanning works in Expo Go on physical devices. The in-app "Grant
   > Permission" button handles the runtime camera prompt.

### Option B — Native build with EAS (for a standalone APK)

1. Log in to Expo: `npx eas login`
2. In the Expo dashboard, open the project's **Environment variables** page and
   add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the
   **Preview** environment. Use the values from your local `.env`; do not use a
   Supabase `service_role` key. These `EXPO_PUBLIC_` values are included in the
   app bundle, so they are not secrets.
3. Create an Android APK: `npx eas build --platform android --profile preview`
4. When the build finishes, open the link on your phone and install the `.apk`.

   The `preview` profile explicitly builds an APK for direct device installation
   without going through the Play Store and uses the EAS **Preview** environment.
   Add the same variables to the **Production** environment before building the
   `production` profile, which produces a Play Store–ready AAB.

### Requirements

- **Android 6.0 (API 23) or newer** — Expo SDK 54 / React Native 0.81 minimum.
- A working camera on the device for the student QR-scanning flow.
- The `expo-camera` config plugin is enabled in `app.json`, so the
  `android.permission.CAMERA` permission is injected into the manifest
  automatically on every build (verified with `npx expo config`).

### Troubleshooting on device

- **"Camera Permission Needed"** — tap **Grant Permission** and accept the
  system prompt. If you permanently denied it, go to
  Settings → Apps → QR-ATT → Permissions → Camera and set it to **Allow**.
- **QR codes never decode** — make sure the code is inside the on-screen frame,
  hold steady, and raise screen brightness. Very dim codes need good lighting.
- **Network errors** — the app talks directly to Supabase, so the phone needs
  internet access (not just the local Wi-Fi the dev server is on).

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
