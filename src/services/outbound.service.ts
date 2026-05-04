import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Outbound } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';

export async function getAllOutbound(): Promise<Outbound[]> {
  const locationId = getOptionalLocationId();
  let query = supabase
    .from('outbound')
    .select('*, items(item_code, item_name, unit), departments(department_name)');
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  const { data, error } = await query
    .order('outbound_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(i18n.t('errors.outbound.fetchFailed', { message: error.message }));
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    item_code: row.items?.item_code ?? '',
    item_name: row.items?.item_name ?? '',
    item_unit: row.items?.unit ?? '',
    department_name: row.departments?.department_name ?? '',
  }));
}

export async function getOutboundById(id: string): Promise<Outbound | null> {
  const { data, error } = await supabase
    .from('outbound')
    .select(
      '*, items(item_code, item_name, unit), departments(department_name)'
    )
    .eq('outbound_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.outbound.getByIdFailed', { message: error.message }));
  }

  return {
    ...data,
    item_code: (data as any).items?.item_code ?? '',
    item_name: (data as any).items?.item_name ?? '',
    item_unit: (data as any).items?.unit ?? '',
    department_name: (data as any).departments?.department_name ?? '',
  };
}

export async function generateReferenceNumber(): Promise<string> {
  const now = new Date();
  const yyyymmdd =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const prefix = `OUT-${yyyymmdd}-`;

  const { data, error } = await supabase
    .from('outbound')
    .select('reference_number')
    .like('reference_number', `${prefix}%`)
    .order('reference_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(i18n.t('errors.outbound.generateRefFailed', { message: error.message }));
  }

  if (!data || data.length === 0) {
    return `${prefix}01`;
  }

  const lastRef = data[0].reference_number as string;
  const lastSeq = parseInt(lastRef.split('-').pop() ?? '0', 10);
  const nextSeq = String(lastSeq + 1).padStart(2, '0');

  return `${prefix}${nextSeq}`;
}

export async function checkStock(
  itemId: string,
  locationId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('inventory')
    .select('current_quantity')
    .eq('item_id', itemId)
    .eq('location_id', locationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return 0;
    }
    throw new Error(i18n.t('errors.outbound.stockCheckFailed', { message: error.message }));
  }

  return data?.current_quantity ?? 0;
}

export async function createOutbound(
  data: Omit<
    Outbound,
    'outbound_id' | 'created_at' | 'item_code' | 'item_name' | 'department_name' | 'item_unit'
  >
): Promise<Outbound> {
  const currentQty = await checkStock(data.item_id, data.location_id);

  if (currentQty < data.quantity) {
    throw new Error(
      i18n.t('errors.outbound.stockInsufficient', {
        current: currentQty,
        requested: data.quantity,
      })
    );
  }

  const referenceNumber = await generateReferenceNumber();

  const { data: created, error: insertError } = await supabase
    .from('outbound')
    .insert({ ...data, reference_number: referenceNumber })
    .select('*, items(item_code, item_name, unit), departments(department_name)')
    .single();

  if (insertError) {
    throw new Error(i18n.t('errors.outbound.createFailed', { message: insertError.message }));
  }

  const { error: updateError } = await supabase
    .from('inventory')
    .update({ current_quantity: currentQty - data.quantity })
    .eq('item_id', data.item_id)
    .eq('location_id', data.location_id);

  if (updateError) {
    throw new Error(i18n.t('errors.outbound.stockDeductFailed', { message: updateError.message }));
  }

  return {
    ...created,
    item_code: (created as any).items?.item_code ?? '',
    item_name: (created as any).items?.item_name ?? '',
    item_unit: (created as any).items?.unit ?? '',
    department_name: (created as any).departments?.department_name ?? '',
  };
}

export async function updateOutbound(
  id: string,
  data: Pick<Outbound, 'item_id' | 'quantity' | 'outbound_date' | 'requester' | 'department_id' | 'purpose' | 'cost_center' | 'notes'>,
  updatedBy: string,
): Promise<Outbound> {
  // Atomic RPC mirrors update_inbound_atomic but with reversed signs:
  // outbound is deductive, so prev.quantity restores stock and new.quantity
  // re-deducts it. Negative-stock guard prevents over-issue on edit.
  const { error } = await supabase.rpc('update_outbound_atomic', {
    p_outbound_id: id,
    p_item_id: data.item_id,
    p_quantity: data.quantity,
    p_outbound_date: data.outbound_date,
    p_requester: data.requester,
    p_department_id: data.department_id,
    p_purpose: data.purpose,
    p_cost_center: data.cost_center,
    p_notes: data.notes,
    p_updated_by: updatedBy,
  });

  if (error) {
    if (error.message.includes('inventory_negative')) {
      throw new Error(i18n.t('errors.outbound.stockInsufficient', {
        current: '?',
        requested: data.quantity,
      }));
    }
    throw new Error(i18n.t('errors.outbound.createFailed', { message: error.message }));
  }

  return getOutboundById(id) as Promise<Outbound>;
}

export async function deleteOutbound(id: string, updatedBy: string): Promise<void> {
  // Atomic RPC restores the deducted quantity and deletes the ledger row.
  // Idempotent — missing row returns false silently.
  const { error } = await supabase.rpc('delete_outbound_atomic', {
    p_outbound_id: id,
    p_updated_by: updatedBy,
  });

  if (error) {
    throw new Error(i18n.t('errors.outbound.deleteFailed', { message: error.message }));
  }
}
