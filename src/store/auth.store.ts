import { create } from 'zustand';
import i18n from '@/i18n/config';
import { supabase } from '@/lib/supabase';
import type { User } from '../types/database.types';
import { useLocationStore } from './location.store';

type SafeUser = Omit<User, 'password_hash'>;

const USER_COLUMNS =
  'user_id, username, full_name, email, role, department_id, location_id, is_active, phone_number, position, created_at, updated_at';

// Pre-Supabase-Auth builds persisted the user object here and trusted it as
// proof of login. It is no longer read; remove it so it cannot linger.
const LEGACY_AUTH_STORAGE_KEY = 'mro-auth-storage';

interface AuthState {
  user: SafeUser | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

// Loads the app profile linked to the Supabase Auth account. RLS lets a user
// read only their own row. Returns an error key when the account cannot use
// the app (no linked profile, or deactivated).
async function loadProfile(authUserId: string): Promise<{ user: SafeUser | null; errorKey: string | null }> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) {
    console.error('사용자 프로필 조회 실패:', error);
    return { user: null, errorKey: 'errors.auth.loginFailed' };
  }
  if (!data) return { user: null, errorKey: 'errors.auth.noProfile' };
  const user = data as SafeUser;
  if (!user.is_active) return { user: null, errorKey: 'errors.auth.inactive' };
  return { user, errorKey: null };
}

let authListenerRegistered = false;

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isInitialized: false,
  isLoading: false,
  error: null,

  // Restores the session Supabase keeps in browser storage. The profile is
  // re-read from the DB every time, so a deactivated account or changed role
  // takes effect on the next load instead of trusting a cached object.
  initialize: async () => {
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
    if (!authListenerRegistered) {
      authListenerRegistered = true;
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') set({ user: null });
      });
    }

    const { data } = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) {
      set({ user: null, isInitialized: true });
      return;
    }
    const { user, errorKey } = await loadProfile(authUser.id);
    if (!user) await supabase.auth.signOut();
    set({ user, isInitialized: true, error: errorKey ? i18n.t(errorKey) : null });
  },

  login: async (email: string, password: string): Promise<boolean> => {
    set({ isLoading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      const invalid = error?.message === 'Invalid login credentials';
      set({ user: null, isLoading: false, error: i18n.t(invalid ? 'auth.loginError' : 'errors.auth.loginFailed') });
      return false;
    }

    const { user, errorKey } = await loadProfile(data.user.id);
    if (!user) {
      await supabase.auth.signOut();
      set({ user: null, isLoading: false, error: i18n.t(errorKey ?? 'errors.auth.loginFailed') });
      return false;
    }
    set({ user, isLoading: false, error: null, isInitialized: true });
    return true;
  },

  // Full reload after sign-out so no factory data from the previous session
  // survives in the in-memory stores.
  logout: async () => {
    await supabase.auth.signOut();
    useLocationStore.getState().clearLocation();
    set({ user: null, isLoading: false, error: null });
    window.location.assign('/login');
  },
}));
