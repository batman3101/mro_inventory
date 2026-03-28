import { supabase } from '@/lib/supabase';
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
    throw new Error(`사용자 목록 조회 실패: ${error.message}`);
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
    throw new Error(`사용자 조회 실패: ${error.message}`);
  }

  return data as SafeUser;
}

export type CreateUserData = Omit<
  User,
  'user_id' | 'created_at' | 'updated_at' | 'password_hash'
> & {
  // password_hash must be set server-side via bcrypt before inserting
  password_hash: string;
};

export async function createUser(data: CreateUserData): Promise<SafeUser> {
  const { data: created, error } = await supabase
    .from('users')
    .insert(data)
    .select(USER_COLUMNS)
    .single();

  if (error) {
    throw new Error(`사용자 생성 실패: ${error.message}`);
  }

  return created as SafeUser;
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
    throw new Error(`사용자 수정 실패: ${error.message}`);
  }

  return updated as SafeUser;
}

export async function deactivateUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('user_id', id);

  if (error) {
    throw new Error(`사용자 비활성화 실패: ${error.message}`);
  }
}

export async function activateUser(id: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: true })
    .eq('user_id', id);

  if (error) {
    throw new Error(`사용자 활성화 실패: ${error.message}`);
  }
}
