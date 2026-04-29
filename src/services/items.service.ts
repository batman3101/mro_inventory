import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Item } from '@/types/database.types';

export async function getAllItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*, categories(category_name)')
    .order('item_code', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.items.fetchFailed', { message: error.message }));
  }

  return data ?? [];
}

export async function getItemById(itemId: string): Promise<Item | null> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('item_id', itemId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.items.getByIdFailed', { message: error.message }));
  }

  return data;
}

export async function createItem(
  data: Omit<Item, 'item_id' | 'created_at' | 'updated_at'>
): Promise<Item> {
  // item_code is user-supplied (사내코드). UNIQUE constraint on the column
  // enforces no duplicates at the DB level.
  const { data: created, error } = await supabase
    .from('items')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.items.createFailed', { message: error.message }));
  }

  return created;
}

export async function updateItem(
  itemId: string,
  data: Partial<Item>
): Promise<Item> {
  const { data: updated, error } = await supabase
    .from('items')
    .update(data)
    .eq('item_id', itemId)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.items.updateFailed', { message: error.message }));
  }

  return updated;
}

export async function deleteItem(itemId: string): Promise<void> {
  // FK refs in: item_prices, inventory, reorder_alerts, inbound, outbound.
  // Inbound/outbound rows are accounting history — refuse delete in that case
  // and tell the user to deactivate (status=DISCONTINUED) instead.
  const [inboundRes, outboundRes] = await Promise.all([
    supabase.from('inbound').select('inbound_id', { count: 'exact', head: true }).eq('item_id', itemId),
    supabase.from('outbound').select('outbound_id', { count: 'exact', head: true }).eq('item_id', itemId),
  ]);

  const inboundCount = inboundRes.count ?? 0;
  const outboundCount = outboundRes.count ?? 0;
  if (inboundCount > 0 || outboundCount > 0) {
    throw new Error(
      i18n.t('errors.items.deleteHasHistory', { inbound: inboundCount, outbound: outboundCount }),
    );
  }

  // Safe to remove: clear dependent rows first, then the item itself.
  // Errors here surface up; partial failure leaves the item intact for retry.
  const { error: priceErr } = await supabase.from('item_prices').delete().eq('item_id', itemId);
  if (priceErr) throw new Error(i18n.t('errors.items.deleteFailed', { message: priceErr.message }));

  const { error: invErr } = await supabase.from('inventory').delete().eq('item_id', itemId);
  if (invErr) throw new Error(i18n.t('errors.items.deleteFailed', { message: invErr.message }));

  const { error: alertErr } = await supabase.from('reorder_alerts').delete().eq('item_id', itemId);
  if (alertErr) throw new Error(i18n.t('errors.items.deleteFailed', { message: alertErr.message }));

  const { error } = await supabase.from('items').delete().eq('item_id', itemId);
  if (error) {
    throw new Error(i18n.t('errors.items.deleteFailed', { message: error.message }));
  }
}

export async function searchItems(query: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or(`item_name.ilike.%${query}%,item_code.ilike.%${query}%`)
    .order('item_code', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.items.searchFailed', { message: error.message }));
  }

  return data ?? [];
}

export async function getItemsByCategory(categoryId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('category_id', categoryId)
    .order('item_code', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.items.fetchByCategoryFailed', { message: error.message }));
  }

  return data ?? [];
}
