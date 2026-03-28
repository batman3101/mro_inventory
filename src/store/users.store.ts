import { create } from 'zustand';
import type { User } from '@/types/database.types';
import * as usersService from '@/services/users.service';
import type { UpdateUserData } from '@/services/users.service';

type SafeUser = Omit<User, 'password_hash'>;

type CreateUserFormData = Omit<
  User,
  'user_id' | 'created_at' | 'updated_at' | 'password_hash'
>;

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
      const message = error instanceof Error ? error.message : '사용자 목록 조회 실패';
      set({ error: message, isLoading: false });
    }
  },

  createUser: async (data) => {
    // password_hash placeholder — real hashing must occur server-side via bcrypt
    const created = await usersService.createUser({
      ...data,
      password_hash: 'PLACEHOLDER_MUST_BE_HASHED_SERVER_SIDE',
    });
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
