import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Inbound } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';

export async function getAllInbound(): Promise<Inbound[]> {
  const locationId = getOptionalLocationId();
  let query = supabase
    .from('inbound')
    .select('*, items(item_code, item_name, unit), suppliers(supplier_name)');
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  const { data, error } = await query
    .order('inbound_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(i18n.t('errors.inbound.fetchFailed', { message: error.message }));
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    item_code: row.items?.item_code ?? '',
    item_name: row.items?.item_name ?? '',
    item_unit: row.items?.unit ?? '',
    supplier_name: row.suppliers?.supplier_name ?? '',
  }));
}

export async function getInboundById(id: string): Promise<Inbound | null> {
  const { data, error } = await supabase
    .from('inbound')
    .select('*, items(item_code, item_name, unit), suppliers(supplier_name)')
    .eq('inbound_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.inbound.getByIdFailed', { message: error.message }));
  }

  return {
    ...data,
    item_code: (data as any).items?.item_code ?? '',
    item_name: (data as any).items?.item_name ?? '',
    item_unit: (data as any).items?.unit ?? '',
    supplier_name: (data as any).suppliers?.supplier_name ?? '',
  };
}

export async function generateReferenceNumber(): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `IN-${dateStr}-`;

  const { data, error } = await supabase
    .from('inbound')
    .select('reference_number')
    .like('reference_number', `${prefix}%`)
    .order('reference_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(i18n.t('errors.inbound.generateRefFailed', { message: error.message }));
  }

  if (!data || data.length === 0) {
    return `${prefix}01`;
  }

  // Reference is `IN-YYYYMMDD-NN` so the trailing seq lives after the last `-`.
  // Reading after the last hyphen lets the seq grow past 99 if a busy day rolls over.
  const lastNumber = data[0].reference_number as string;
  const lastSeq = parseInt(lastNumber.split('-').pop() ?? '0', 10);
  const nextSeq = String(lastSeq + 1).padStart(2, '0');

  return `${prefix}${nextSeq}`;
}

export async function createInbound(
  data: Omit<Inbound, 'inbound_id' | 'created_at' | 'reference_number' | 'total_price' | 'item_code' | 'item_name' | 'supplier_name' | 'item_unit'>
): Promise<Inbound> {
  const reference_number = await generateReferenceNumber();
  const total_price = data.quantity * data.unit_price;

  const { data: created, error } = await supabase
    .from('inbound')
    .insert({ ...data, reference_number, total_price })
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.inbound.createFailed', { message: error.message }));
  }

  const { data: existing, error: invFetchError } = await supabase
    .from('inventory')
    .select('inventory_id, current_quantity')
    .eq('item_id', data.item_id)
    .eq('location_id', data.location_id)
    .maybeSingle();

  if (invFetchError) {
    throw new Error(i18n.t('errors.inbound.inventoryFetchFailed', { message: invFetchError.message }));
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        current_quantity: existing.current_quantity + data.quantity,
        updated_at: new Date().toISOString(),
        updated_by: data.created_by,
      })
      .eq('inventory_id', existing.inventory_id);

    if (updateError) {
      throw new Error(i18n.t('errors.inbound.inventoryUpdateFailed', { message: updateError.message }));
    }
  } else {
    const { error: insertError } = await supabase
      .from('inventory')
      .insert({
        item_id: data.item_id,
        location_id: data.location_id,
        current_quantity: data.quantity,
        last_count_date: new Date().toISOString(),
        storage_location: '',
        updated_by: data.created_by,
      });

    if (insertError) {
      throw new Error(i18n.t('errors.inbound.inventoryCreateFailed', { message: insertError.message }));
    }
  }

  return getInboundById(created.inbound_id) as Promise<Inbound>;
}

export async function updateInbound(
  id: string,
  data: Pick<Inbound, 'item_id' | 'supplier_id' | 'quantity' | 'unit_price' | 'currency' | 'notes' | 'inbound_date'>
): Promise<Inbound> {
  const total_price = data.quantity * data.unit_price;

  const { error } = await supabase
    .from('inbound')
    .update({ ...data, total_price })
    .eq('inbound_id', id);

  if (error) {
    throw new Error(i18n.t('errors.inbound.updateFailed', { message: error.message }));
  }

  return getInboundById(id) as Promise<Inbound>;
}

export async function deleteInbound(id: string): Promise<void> {
  const { error } = await supabase
    .from('inbound')
    .delete()
    .eq('inbound_id', id);

  if (error) {
    throw new Error(i18n.t('errors.inbound.deleteFailed', { message: error.message }));
  }
}
