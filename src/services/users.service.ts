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

// User writes go through the server API, which checks that the caller is an
// active system_admin. The Supabase access token proves who the caller is.
async function authConfig() {
  const { data } = await supabase.auth.getSession();
  return { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } };
}

function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data?.error) {
    return err.response.data.error as string;
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export type CreateUserData = Omit<
  User,
  'user_id' | 'created_at' | 'updated_at' | 'password_hash'
> & {
  password: string;
};

export async function createUser(data: CreateUserData): Promise<SafeUser> {
  try {
    const response = await axios.post<{ user: SafeUser }>('/api/users', data, await authConfig());
    return response.data.user;
  } catch (err) {
    throw new Error(i18n.t('errors.users.createFailed', { message: apiErrorMessage(err) }));
  }
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  try {
    await axios.post(`/api/users/${id}/password`, { password }, await authConfig());
  } catch (err) {
    throw new Error(i18n.t('errors.users.updateFailed', { message: apiErrorMessage(err) }));
  }
}

export type UpdateUserData = Partial<
  Omit<User, 'user_id' | 'created_at' | 'password_hash'>
>;

export async function updateUser(id: string, data: UpdateUserData): Promise<SafeUser> {
  try {
    const response = await axios.patch<{ user: SafeUser }>(`/api/users/${id}`, data, await authConfig());
    return response.data.user;
  } catch (err) {
    throw new Error(i18n.t('errors.users.updateFailed', { message: apiErrorMessage(err) }));
  }
}

export async function deactivateUser(id: string): Promise<void> {
  try {
    await axios.patch(`/api/users/${id}`, { is_active: false }, await authConfig());
  } catch (err) {
    throw new Error(i18n.t('errors.users.deactivateFailed', { message: apiErrorMessage(err) }));
  }
}

export async function activateUser(id: string): Promise<void> {
  try {
    await axios.patch(`/api/users/${id}`, { is_active: true }, await authConfig());
  } catch (err) {
    throw new Error(i18n.t('errors.users.activateFailed', { message: apiErrorMessage(err) }));
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    await axios.delete(`/api/users/${id}`, await authConfig());
  } catch (err) {
    throw new Error(i18n.t('errors.users.deleteFailed', { message: apiErrorMessage(err) }));
  }
}
