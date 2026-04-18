import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import i18n from '@/i18n/config';
import type { User } from '../types/database.types';
import { useLocationStore } from './location.store';

type SafeUser = Omit<User, 'password_hash'>;

interface AuthState {
  user: SafeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  restoreSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        // DEV mode: frontend-only test user without Supabase/server
        if (email === 'admin@mro.dev' && password === 'admin1234') {
          const devUser: SafeUser = {
            user_id: 'dev-admin-uuid',
            username: 'admin',
            full_name: i18n.t('auth.devAdminFullName'),
            email: 'admin@mro.dev',
            role: 'system_admin',
            department_id: null,
            location_id: null,
            is_active: true,
            phone_number: '010-0000-0000',
            position: i18n.t('auth.devAdminPosition'),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          set({ user: devUser, isAuthenticated: true, isLoading: false, error: null });
          useLocationStore.getState().setCurrentLocation('loc-1', 'ALT');
          return true;
        }

        try {
          const response = await axios.post<{ user: SafeUser }>('/api/auth/login', {
            email,
            password,
          });
          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (err) {
          const message =
            axios.isAxiosError(err) && err.response?.data?.error
              ? (err.response.data.error as string)
              : i18n.t('errors.auth.loginFailed');
          set({ user: null, isAuthenticated: false, isLoading: false, error: message });
          return false;
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        localStorage.removeItem('mro-auth-storage');
      },

      restoreSession: () => {
        const { user } = get();
        if (user) {
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: 'mro-auth-storage',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          state.isAuthenticated = true;
        }
      },
    }
  )
);
