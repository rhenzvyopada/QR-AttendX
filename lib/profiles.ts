import { supabase } from './supabase';

export type ProfileRole = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'role'>>
) {
  return supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
}
