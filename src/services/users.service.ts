import axios from 'axios';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { User } from '@/types/database.types';

type SafeUser = Omit<User, 'password_hash'>;

const USER_COLUMNS =
  'user_id, username, full_name, email, role, department_id, location_id, is_active, phone_number, position, created_at, updated_at';

export async function getAllUsers(): Promise<SafeUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .order('username', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.users.fetchFailed', { message: error.message }));
  }

  return (data ?? []) as SafeUser[];
}

export async function getUserById(id: string): Promise<SafeUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('user_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.users.getByIdFailed', { message: error.message }));
  }

  return data as SafeUser;
}

export type CreateUserData = Omit<
  User,
  'user_id' | 'created_at' | 'updated_at' | 'password_hash'
> & {
  password: string;
};

export async function createUser(data: CreateUserData): Promise<SafeUser> {
  try {
    const response = await axios.post<{ user: SafeUser }>('/api/users', data);
    return response.data.user;
  } catch (err) {
    const serverError =
      axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    throw new Error(i18n.t('errors.users.createFailed', { message: serverError }));
  }
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  try {
    await axios.post(`/api/users/${id}/password`, { password });
  } catch (err) {
    const serverError =
      axios.isAxiosError(err) && err.response?.data?.error
        ? (err.response.data.error as string)
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    throw new Error(i18n.t('errors.users.updateFailed', { message: serverError }));
  }
}

export type UpdateUserData = Partial<
  Omit<User, 'user_id' | 'created_at' | 'password_hash'>
>;

export async function updateUser(id: string, data: UpdateUserData): Promise<SafeUser> {
  const { data: updated, error } = await supabase
    .from('users')
    .update(data)
    .eq('user_id', id)
    .select(USER_COLUMNS)
    .single();

  if (error) {
    throw new Error(i18n.t('errors.users.updateFailed', { message: error.message }));
  }

  return updated as SafeUser;
}

export async function deactivateUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('user_id', id);

  if (error) {
    throw new Error(i18n.t('errors.users.deactivateFailed', { message: error.message }));
  }
}

export async function activateUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('user_id', id);

  if (error) {
    throw new Error(i18n.t('errors.users.activateFailed', { message: error.message }));
  }
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('user_id', id)
    .eq('is_active', false);

  if (error) {
    throw new Error(i18n.t('errors.users.deleteFailed', { message: error.message }));
  }
}
