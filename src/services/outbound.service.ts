import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Outbound } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';
import { fetchAllRows } from '@/lib/fetchAll';

type OutboundRow = Outbound & {
  items: { item_code: string; item_name: string; unit: string } | null;
  departments: { department_name: string } | null;
};

export async function getAllOutbound(): Promise<Outbound[]> {
  const locationId = getOptionalLocationId();
  let data: OutboundRow[];
  try {
    data = await fetchAllRows<OutboundRow>((from, to) => {
      let query = supabase
        .from('outbound')
        .select('*, items(item_code, item_name, unit), departments(department_name)');
      if (locationId) {
        query = query.eq('location_id', locationId);
      }
      return query
        .order('outbound_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('outbound_id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: OutboundRow[] | null; error: { message: string } | null }>;
    });
  } catch (e) {
    throw new Error(i18n.t('errors.outbound.fetchFailed', { message: e instanceof Error ? e.message : String(e) }));
  }

  return data.map((row) => ({
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

// One DB transaction (create_outbound_atomic): locks the stock row, rejects
// over-issue, writes the ledger row with a server-side reference number and
// deducts stock. Nothing is left behind on failure.
export async function createOutbound(
  data: Omit<
    Outbound,
    'outbound_id' | 'created_at' | 'item_code' | 'item_name' | 'department_name' | 'item_unit'
  >
): Promise<Outbound> {
  // Every argument must be present (undefined keys are dropped and the RPC
  // signature would no longer match), so optional fields fall back to null.
  const { data: outboundId, error } = await supabase.rpc('create_outbound_atomic', {
    p_outbound_date: data.outbound_date,
    p_item_id: data.item_id,
    p_location_id: data.location_id,
    p_quantity: data.quantity,
    p_requester: data.requester,
    p_department_id: data.department_id ?? null,
    p_purpose: data.purpose ?? null,
    p_cost_center: data.cost_center ?? null,
    p_notes: data.notes ?? null,
    p_created_by: data.created_by ?? null,
  });

  if (error) {
    const insufficient = error.message.match(/inventory_insufficient:(\d+)/);
    if (insufficient) {
      throw new Error(
        i18n.t('errors.outbound.stockInsufficient', {
          current: Number(insufficient[1]),
          requested: data.quantity,
        })
      );
    }
    throw new Error(i18n.t('errors.outbound.createFailed', { message: error.message }));
  }

  return getOutboundById(outboundId as string) as Promise<Outbound>;
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
