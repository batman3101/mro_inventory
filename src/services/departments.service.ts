import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Department } from '@/types/database.types';

export async function getAllDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('department_code', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.departments.fetchFailed', { message: error.message }));
  }

  return data ?? [];
}

export async function getDepartmentById(departmentId: string): Promise<Department | null> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('department_id', departmentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.departments.getByIdFailed', { message: error.message }));
  }

  return data;
}

export async function createDepartment(
  data: Omit<Department, 'department_id' | 'created_at' | 'updated_at'>
): Promise<Department> {
  const { data: created, error } = await supabase
    .from('departments')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.departments.createFailed', { message: error.message }));
  }

  return created;
}

export async function updateDepartment(
  departmentId: string,
  data: Partial<Omit<Department, 'department_id' | 'created_at'>>
): Promise<Department> {
  const { data: updated, error } = await supabase
    .from('departments')
    .update(data)
    .eq('department_id', departmentId)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.departments.updateFailed', { message: error.message }));
  }

  return updated;
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('department_id', departmentId);

  if (error) {
    throw new Error(i18n.t('errors.departments.deleteFailed', { message: error.message }));
  }
}
