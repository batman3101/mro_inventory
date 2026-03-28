import { supabase } from '@/lib/supabase';
import type { Department } from '@/types/database.types';

export async function getAllDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('department_code', { ascending: true });

  if (error) {
    throw new Error(`부서 목록 조회 실패: ${error.message}`);
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
    throw new Error(`부서 조회 실패: ${error.message}`);
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
    throw new Error(`부서 생성 실패: ${error.message}`);
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
    throw new Error(`부서 수정 실패: ${error.message}`);
  }

  return updated;
}

export async function deleteDepartment(departmentId: string): Promise<void> {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('department_id', departmentId);

  if (error) {
    throw new Error(`부서 삭제 실패: ${error.message}`);
  }
}
