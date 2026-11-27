import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Inbound } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';
import { fetchAllRows } from '@/lib/fetchAll';

type InboundRow = Inbound & {
  items: { item_code: string; item_name: string; unit: string } | null;
  suppliers: { supplier_name: string } | null;
};

export async function getAllInbound(): Promise<Inbound[]> {
  const locationId = getOptionalLocationId();
  let data: InboundRow[];
  try {
    data = await fetchAllRows<InboundRow>((from, to) => {
      let query = supabase
        .from('inbound')
        .select('*, items(item_code, item_name, unit), suppliers(supplier_name)');
      if (locationId) {
        query = query.eq('location_id', locationId);
      }
      return query
        .order('inbound_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('inbound_id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: InboundRow[] | null; error: { message: string } | null }>;
    });
  } catch (e) {
    throw new Error(i18n.t('errors.inbound.fetchFailed', { message: e instanceof Error ? e.message : String(e) }));
  }

  return data.map((row) => ({
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

// One DB transaction (create_inbound_atomic): ledger row + stock increase +
// server-side reference number. A failure leaves neither behind, and
// concurrent creates cannot overwrite each other's stock or reuse a number.
export async function createInbound(
  data: Omit<Inbound, 'inbound_id' | 'created_at' | 'reference_number' | 'total_price' | 'item_code' | 'item_name' | 'supplier_name' | 'item_unit'>
): Promise<Inbound> {
  // Every argument must be present (undefined keys are dropped and the RPC
  // signature would no longer match), so optional fields fall back to null.
  const { data: inboundId, error } = await supabase.rpc('create_inbound_atomic', {
    p_inbound_date: data.inbound_date,
    p_item_id: data.item_id,
    p_supplier_id: data.supplier_id ?? null,
    p_location_id: data.location_id,
    p_quantity: data.quantity,
    p_unit_price: data.unit_price ?? null,
    p_currency: data.currency || 'VND',
    p_notes: data.notes ?? null,
    p_created_by: data.created_by ?? null,
  });

  if (error) {
    throw new Error(i18n.t('errors.inbound.createFailed', { message: error.message }));
  }

  return getInboundById(inboundId as string) as Promise<Inbound>;
}

export async function updateInbound(
  id: string,
  data: Pick<Inbound, 'item_id' | 'supplier_id' | 'quantity' | 'unit_price' | 'currency' | 'notes' | 'inbound_date'>,
  updatedBy: string,
): Promise<Inbound> {
  // Single atomic RPC: row update + inventory delta(s) commit or rollback
  // together. No partial-failure desync, no retry double-counting, no race
  // with concurrent in/out writers — the server takes a row lock.
  const { error } = await supabase.rpc('update_inbound_atomic', {
    p_inbound_id: id,
    p_item_id: data.item_id,
    p_supplier_id: data.supplier_id,
    p_quantity: data.quantity,
    p_unit_price: data.unit_price,
    p_currency: data.currency,
    p_notes: data.notes,
    p_inbound_date: data.inbound_date,
    p_updated_by: updatedBy,
  });

  if (error) {
    if (error.message.includes('inventory_negative')) {
      throw new Error(i18n.t('errors.inventory.deltaNegative', { current: '?', delta: data.quantity }));
    }
    throw new Error(i18n.t('errors.inbound.updateFailed', { message: error.message }));
  }

  return getInboundById(id) as Promise<Inbound>;
}

export async function deleteInbound(id: string, updatedBy: string): Promise<void> {
  // Atomic RPC: undo inventory contribution + delete ledger row in one tx.
  // Idempotent — a missing row returns false silently.
  const { error } = await supabase.rpc('delete_inbound_atomic', {
    p_inbound_id: id,
    p_updated_by: updatedBy,
  });

  if (error) {
    if (error.message.includes('inventory_negative')) {
      throw new Error(i18n.t('errors.inventory.deltaNegative', { current: '?', delta: 0 }));
    }
    throw new Error(i18n.t('errors.inbound.deleteFailed', { message: error.message }));
  }
}
