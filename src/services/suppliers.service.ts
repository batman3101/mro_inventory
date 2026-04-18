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
