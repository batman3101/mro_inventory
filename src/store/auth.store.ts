import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import type { User } from '../types/database.types';

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
              : '로그인 중 오류가 발생했습니다.';
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
    }
  )
);
