import type { Session, User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { ensureProfile } from './profiles';
import { isSupabaseConfigured, supabase } from './supabase';
import { eventBus, type EventName } from './attendance';

export type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher' | 'administrator';
};

let state: AuthState = { session: null, user: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;

function emit(next: AuthState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyLogin(user: User): void {
  eventBus.emit('userLogin', { userId: user.id, email: user.email ?? null });
}

function notifyLogout(userId: string): void {
  eventBus.emit('userLoggedOut', { userId });
}

export function setAuth(session: Session | null) {
  emit({ session, user: session?.user ?? null, loading: false });
  // Existing accounts created before the schema was applied have no profile
  // row; make sure one exists so RLS policies (such as event creation) pass.
  if (session?.user.id) {
    void ensureProfile(session.user.id);
  }
  if (session?.user) {
    notifyLogin(session.user);
  }
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export async function initializeAuth() {
  if (initialized) return;
  initialized = true;

  if (!isSupabaseConfigured) {
    setAuth(null);
    return;
  }

  const { data } = await supabase.auth.getSession();
  setAuth(data.session);
  supabase.auth.onAuthStateChange((_event, session) => setAuth(session));
}

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: profile
      ? {
          data: {
            full_name: profile.full_name,
            role: profile.role,
          },
        }
      : undefined,
  });

  if (!error && data.session) {
    if (profile) {
      await supabase
        .from('profiles')
        .update({ full_name: profile.full_name, role: profile.role })
        .eq('id', data.session.user.id);
    }
    setAuth(data.session);
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error && data.session) setAuth(data.session);
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    notifyLogout(state.user?.id ?? '');
    setAuth(null);
  }
  return { error };
}
