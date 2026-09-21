import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Supplier } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';

export async function getAllSuppliers(): Promise<Supplier[]> {
  const locationId = getOptionalLocationId();
  let query = supabase.from('suppliers').select('*');
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  const { data, error } = await query.order('supplier_code', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.suppliers.fetchFailed', { message: error.message }));
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
    throw new Error(i18n.t('errors.suppliers.getByIdFailed', { message: error.message }));
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
    throw new Error(i18n.t('errors.suppliers.createFailed', { message: error.message }));
  }

  return created;
}

const AUTO_CODE_PREFIX = 'SUP-';
const AUTO_CODE_MAX_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

// supplier_code 는 공장 구분 없이 전역 UNIQUE 이므로 location 필터 없이 조회한다.
async function getMaxAutoCodeNumber(): Promise<number> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('supplier_code')
    .like('supplier_code', `${AUTO_CODE_PREFIX}%`);

  if (error) {
    throw new Error(i18n.t('errors.suppliers.createFailed', { message: error.message }));
  }

  return (data ?? []).reduce((max, row) => {
    const match = /^SUP-(\d+)$/.exec(row.supplier_code);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
}

// 동시 등록으로 같은 번호를 받으면 UNIQUE 위반이 나므로 다음 번호로 재시도한다.
export async function createSupplierWithAutoCode(
  data: Omit<Supplier, 'supplier_id' | 'supplier_code' | 'created_at' | 'updated_at'>
): Promise<Supplier> {
  const maxNumber = await getMaxAutoCodeNumber();

  for (let attempt = 1; attempt <= AUTO_CODE_MAX_ATTEMPTS; attempt++) {
    const supplier_code = `${AUTO_CODE_PREFIX}${String(maxNumber + attempt).padStart(3, '0')}`;
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert({ ...data, supplier_code })
      .select()
      .single();

    if (!error) return created;
    if (error.code !== UNIQUE_VIOLATION) {
      throw new Error(i18n.t('errors.suppliers.createFailed', { message: error.message }));
    }
  }

  throw new Error(i18n.t('errors.suppliers.autoCodeFailed'));
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
    throw new Error(i18n.t('errors.suppliers.updateFailed', { message: error.message }));
  }

  return updated;
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('supplier_id', supplierId);

  if (error) {
    throw new Error(i18n.t('errors.suppliers.deleteFailed', { message: error.message }));
  }
}
