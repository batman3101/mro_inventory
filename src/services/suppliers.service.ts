import { supabase } from '@/lib/supabase';
import type { Supplier } from '@/types/database.types';

export async function getAllSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('supplier_code', { ascending: true });

  if (error) {
    throw new Error(`공급업체 목록 조회 실패: ${error.message}`);
  }

  return data ?? [];
}

export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('supplier_id', supplierId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`공급업체 조회 실패: ${error.message}`);
  }

  return data;
}

export async function createSupplier(
  data: Omit<Supplier, 'supplier_id' | 'created_at' | 'updated_at'>
): Promise<Supplier> {
  const { data: created, error } = await supabase
    .from('suppliers')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`공급업체 생성 실패: ${error.message}`);
  }

  return created;
}

export async function updateSupplier(
  supplierId: string,
  data: Partial<Supplier>
): Promise<Supplier> {
  const { data: updated, error } = await supabase
    .from('suppliers')
    .update(data)
    .eq('supplier_id', supplierId)
    .select()
    .single();

  if (error) {
    throw new Error(`공급업체 수정 실패: ${error.message}`);
  }

  return updated;
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('supplier_id', supplierId);

  if (error) {
    throw new Error(`공급업체 삭제 실패: ${error.message}`);
  }
}
