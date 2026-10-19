import { isMissingTableError } from './db';
import { supabase } from './supabase';

export type ProfileRole = 'student' | 'teacher' | 'administrator';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  phone: string | null;
  address: string | null;
  city: string | null;
  date_of_birth: string | null;
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdate = Partial<
  Pick<
    Profile,
    'full_name' | 'role' | 'phone' | 'address' | 'city' | 'date_of_birth' | 'emergency_contact'
  >
>;

export type ProfileUpdateResult = { error: { message: string } | null };

function coerceRole(value: unknown): ProfileRole {
  if (value === 'teacher' || value === 'administrator') return value;
  return 'student';
}

/** Type guard for the administrator role. */
export function isAdministrator(role: ProfileRole | null | undefined): boolean {
  return role === 'administrator';
}

/** Builds a profile object from the signed-in user's auth metadata. */
export function profileFromMetadata(user: {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown> | null;
}): Profile {
  const metadata = user.user_metadata ?? {};
  const rawName = metadata.full_name;
  const fullName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
  const timestamp = user.created_at ?? new Date().toISOString();
  return {
    id: user.id,
    email: user.email ?? '',
    full_name: fullName,
    role: coerceRole(metadata.role),
    phone: typeof metadata.phone === 'string' ? metadata.phone : null,
    address: typeof metadata.address === 'string' ? metadata.address : null,
    city: typeof metadata.city === 'string' ? metadata.city : null,
    date_of_birth: typeof metadata.date_of_birth === 'string' ? metadata.date_of_birth : null,
    emergency_contact:
      typeof metadata.emergency_contact === 'string' ? metadata.emergency_contact : null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  // Auth metadata is available only when the signed-in user matches the id we
  // were asked about; it carries the role chosen at sign-up.
  const metadataProfile = user && user.id === userId ? profileFromMetadata(user) : null;

  // The row query can fail for reasons other than a missing table (stale schema
  // cache, transient network/permission error, etc.). Instead of returning null
  // and blanking the whole profile ("Unavailable" account type), fall back to
  // the signed-in user's auth metadata when we have it.
  if (error && !isMissingTableError(error)) {
    return metadataProfile ?? (data ? (data as Profile) : null);
  }

  if (!metadataProfile) return data ? (data as Profile) : null;

  if (!data) return metadataProfile;

  const row = data as Partial<Profile>;
  return {
    ...metadataProfile,
    ...row,
    // Never trust a raw DB value for the role: coerce it so an unexpected or
    // empty value can't surface as "Unavailable" on the Profile screen.
    role: coerceRole(row.role ?? metadataProfile.role),
    phone: 'phone' in row ? row.phone ?? null : metadataProfile.phone,
    address: 'address' in row ? row.address ?? null : metadataProfile.address,
    city: 'city' in row ? row.city ?? null : metadataProfile.city,
    date_of_birth: 'date_of_birth' in row ? row.date_of_birth ?? null : metadataProfile.date_of_birth,
    emergency_contact:
      'emergency_contact' in row ? row.emergency_contact ?? null : metadataProfile.emergency_contact,
  };
}

const ensuredUsers = new Set<string>();

/**
 * Makes sure a `public.profiles` row exists for the given user.
 *
 * Accounts created before `supabase/schema.sql` was applied have no profile
 * row (the `on_auth_user_created` trigger only fires for new sign-ups). That
 * makes the "Users can insert events" policy fail with
 * `new row violates row-level security policy for table "events"`.
 *
 * This recreates the row from the signed-in user's metadata when it is missing.
 */
export async function ensureProfile(userId: string): Promise<void> {
  if (ensuredUsers.has(userId)) return;

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  // Table unavailable / lookup failed: nothing to do here.
  if (error) return;
  if (data) {
    ensuredUsers.add(userId);
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || user.id !== userId) return;

  const metadata = user.user_metadata ?? {};
  const rawName = metadata.full_name;
  const { error: insertError } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: user.email ?? '',
      full_name: typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null,
      role: coerceRole(metadata.role),
      phone: typeof metadata.phone === 'string' ? metadata.phone : null,
      address: typeof metadata.address === 'string' ? metadata.address : null,
      city: typeof metadata.city === 'string' ? metadata.city : null,
      date_of_birth: typeof metadata.date_of_birth === 'string' ? metadata.date_of_birth : null,
      emergency_contact:
        typeof metadata.emergency_contact === 'string' ? metadata.emergency_contact : null,
    },
    { onConflict: 'id' }
  );

  if (!insertError) ensuredUsers.add(userId);
}

/** Returns the admin profile for the current user, or null when the signed-in
 * account is not an administrator.
 *
 * The role can live in the signed-in user's auth metadata (chosen at sign-up)
 * even when the `public.profiles` row is missing — for example, accounts that
 * were created before `supabase/schema.sql` (and its `on_auth_user_created`
 * trigger) was applied. In that case the Profile screen shows "Administrator"
 * (it reads metadata) while this check — which only read the table — wrongly
 * blocked access. We therefore fall back to the metadata role and backfill the
 * missing profiles row so the RLS policies that test
 * `profiles.role = 'administrator'` also pass. */
export async function getAdminProfile(): Promise<Profile | null> {
  const { data: authUser } = await supabase.auth.getUser();
  const user = authUser.user;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id ?? null)
    .eq('role', 'administrator')
    .maybeSingle();

  // A real administrator row is authoritative.
  if (!error && data) return data as Profile;

  if (!user) return null;

  // Fall back to the role stored in the user's auth metadata.
  const metadataProfile = profileFromMetadata(user);
  if (!isAdministrator(metadataProfile.role)) return null;

  // Backfill the missing profiles row from metadata so the administrator RLS
  // policies (which read public.profiles) pass for the admin screens.
  await ensureProfile(user.id);

  return metadataProfile;
}


/**
 * Lists all user accounts so an administrator can manage them.
 *
 * Only administrators may call this. A non-administrator receives an empty
 * list instead of an error, which enforces role-based access at the client
 * layer as well as the database layer.
 */
export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error && !isMissingTableError(error)) return [];
  return (data ?? []) as Profile[];
}

/** Updates a user's role. Only administrators may change roles. */
export async function setUserRole(
  userId: string,
  role: ProfileRole
): Promise<ProfileUpdateResult> {
  const { data: me } = await supabase.auth.getUser();
  const currentId = me.user?.id;

  // Enforce role-based access: only the user's own profile or an
  // administrator may change roles.
  if (currentId !== userId) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentId)
      .eq('role', 'administrator')
      .maybeSingle();

    if (!adminCheck?.id) return { error: { message: 'Only administrators can change roles.' } };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (!error || !isMissingTableError(error)) return { error: null };
  return { error: { message: error.message ?? 'Could not update role.' } };
}

/** Updates a user's profile fields (full name, contact details). */
export async function updateAnyProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<ProfileUpdateResult> {
  const { data: me } = await supabase.auth.getUser();
  const currentId = me.user?.id;

  // Owners may edit their own profile; administrators may edit anyone.
  if (currentId !== userId) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentId)
      .eq('role', 'administrator')
      .maybeSingle();

    if (!adminCheck?.id) return { error: { message: 'You are not permitted to edit this profile.' } };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (!error || !isMissingTableError(error)) return { error: null };
  return { error: { message: error.message ?? 'Could not update profile.' } };
}

/** Removes a user account. Only an administrator may delete accounts. */
export async function deleteUser(userId: string): Promise<ProfileUpdateResult> {
  const { data: me } = await supabase.auth.getUser();
  const currentId = me.user?.id;

  if (currentId !== userId) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentId)
      .eq('role', 'administrator')
      .maybeSingle();

    if (!adminCheck?.id) return { error: { message: 'Only administrators can delete accounts.' } };
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  return { error: error ? { message: error.message } : null };
}

/** Corrects a duplicate/invalid attendance record. Also removes a record. */
export async function setAttendance(
  studentId: string,
  eventId: string,
  scannedAt: string | null
): Promise<{ error: { message: string } | null }> {
  const { data: me } = await supabase.auth.getUser();
  const currentId = me.user?.id;

  // Only the record owner or an administrator may correct attendance.
  if (currentId !== studentId) {
    const { data: adminCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', currentId)
      .eq('role', 'administrator')
      .maybeSingle();

    if (!adminCheck?.id) return { error: { message: 'Only the student or an administrator can correct attendance.' } };
  }

  if (scannedAt === null) {
    const { error } = await supabase.from('attendance').delete().eq('student_id', studentId).eq('event_id', eventId);
    return { error: error ? { message: error.message } : null };
  }

  const { error } = await supabase
    .from('attendance')
    .update({ scanned_at: scannedAt })
    .eq('student_id', studentId)
    .eq('event_id', eventId);

  return { error: error ? { message: error.message } : null };
}

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<ProfileUpdateResult> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (!error || !isMissingTableError(error)) return { error };

  // Fall back to the auth user's metadata so the account type and name still
  // save when the `profiles` table is not available.
  const { error: metadataError } = await supabase.auth.updateUser({ data: updates });
  return { error: metadataError };
}
