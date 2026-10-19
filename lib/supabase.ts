import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/**
 * `expo-secure-store` is a native module: importing it runs
 * `requireNativeModule('ExpoSecureStore')`, which throws when the running app
 * does not include it (for example when a stale Metro/dev-server bundle is
 * loaded). Loading it defensively keeps the app usable instead of crashing on
 * startup with a red screen. Restart the dev server (`npx expo start -c`) if
 * this warning appears unexpectedly.
 */
function createSecureStoreAdapter(): AuthStorage | null {
  try {
    const secureStore = require('expo-secure-store');
    return {
      getItem: (key: string) => secureStore.getItemAsync(key),
      setItem: (key: string, value: string) => secureStore.setItemAsync(key, value),
      removeItem: (key: string) => secureStore.deleteItemAsync(key),
    };
  } catch {
    console.warn(
      '[supabase] SecureStore native module is unavailable; using in-memory session storage. ' +
        'Restart the Expo dev server if this is unexpected.'
    );
    return null;
  }
}

/** Minimal in-memory fallback used only when SecureStore cannot be loaded. */
function createMemoryAdapter(): AuthStorage {
  const store = new Map<string, string>();
  return {
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async (key) => {
      store.delete(key);
    },
  };
}

// On web, `undefined` lets Supabase use localStorage (persists across reloads).
// On native, prefer the encrypted SecureStore and degrade to memory if missing.
const authStorage: AuthStorage | undefined =
  Platform.OS === 'web' ? undefined : createSecureStoreAdapter() ?? createMemoryAdapter();

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
