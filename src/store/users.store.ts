import { create } from 'zustand';
import i18n from '@/i18n/config';
import type { User } from '@/types/database.types';
import * as usersService from '@/services/users.service';
import type { UpdateUserData } from '@/services/users.service';

type SafeUser = Omit<User, 'password_hash'>;

type CreateUserFormData = Omit<
  User,
  'user_id' | 'created_at' | 'updated_at' | 'password_hash'
> & {
  password: string;
};

interface UsersState {
  users: SafeUser[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (data: CreateUserFormData) => Promise<void>;
  updateUser: (id: string, data: UpdateUserData) => Promise<void>;
  deactivateUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
}

export const useUsersStore = create<UsersState>((set) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const users = await usersService.getAllUsers();
      set({ users, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n.t('errors.users.listFallback');
      set({ error: message, isLoading: false });
    }
  },

  createUser: async (data) => {
    const created = await usersService.createUser(data);
    set((state) => ({ users: [...state.users, created] }));
  },

  updateUser: async (id, data) => {
    const updated = await usersService.updateUser(id, data);
    set((state) => ({
      users: state.users.map((u) => (u.user_id === id ? { ...u, ...updated } : u)),
    }));
  },

  deactivateUser: async (id) => {
    await usersService.deactivateUser(id);
    set((state) => ({
      users: state.users.map((u) =>
        u.user_id === id ? { ...u, is_active: false } : u
      ),
    }));
  },

  activateUser: async (id) => {
    await usersService.activateUser(id);
    set((state) => ({
      users: state.users.map((u) =>
        u.user_id === id ? { ...u, is_active: true } : u
      ),
    }));
  },
}));
