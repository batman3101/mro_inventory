import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { ItemPrice } from '@/types/database.types';

// Prices are per factory: history is read for the given factory only.
export async function getItemPrices(itemId: string, locationId: string): Promise<ItemPrice[]> {
  const { data, error } = await supabase
    .from('item_prices')
    .select('*')
    .eq('item_id', itemId)
    .eq('location_id', locationId)
    .order('effective_from', { ascending: false });

  if (error) {
    throw new Error(i18n.t('errors.itemPrice.fetchFailed', { message: error.message }));
  }

  return data ?? [];
}

export async function getCurrentPrice(itemId: string): Promise<ItemPrice | null> {
  const { data, error } = await supabase
    .from('item_prices')
    .select('*')
    .eq('item_id', itemId)
    .eq('is_current', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.itemPrice.currentFetchFailed', { message: error.message }));
  }

  return data;
}

export type ItemPriceInput = Omit<ItemPrice, 'price_id' | 'created_at' | 'supplier_name' | 'source'>;

// Single atomic RPC (save_item_price). Without priceId it upserts on
// (item, factory, supplier, effective_from); with priceId it updates that row,
// which must belong to the same item and factory. When is_current is true the
// other current price of the same item in the same factory is cleared in the
// same transaction, so a failure never leaves the item without a price and
// there is never more than one current price.
export async function saveItemPrice(data: ItemPriceInput, priceId: string | null = null): Promise<ItemPrice> {
  const { data: savedId, error } = await supabase.rpc('save_item_price', {
    p_price_id: priceId,
    p_item_id: data.item_id,
    p_location_id: data.location_id,
    p_unit_price: data.unit_price,
    p_currency: data.currency || 'VND',
    p_supplier_id: data.supplier_id ?? null,
    p_effective_from: data.effective_from,
    p_effective_to: data.effective_to ?? null,
    p_is_current: data.is_current ?? true,
    p_created_by: data.created_by ?? null,
  });

  if (error) {
    throw new Error(i18n.t(priceId ? 'errors.itemPrice.updateFailed' : 'errors.itemPrice.createFailed', { message: error.message }));
  }

  const { data: saved, error: fetchError } = await supabase
    .from('item_prices')
    .select('*')
    .eq('price_id', savedId as string)
    .single();

  if (fetchError) {
    throw new Error(i18n.t('errors.itemPrice.fetchFailed', { message: fetchError.message }));
  }

  return saved;
}

export async function deleteItemPrice(priceId: string): Promise<void> {
  const { error } = await supabase
    .from('item_prices')
    .delete()
    .eq('price_id', priceId);

  if (error) {
    throw new Error(i18n.t('errors.itemPrice.deleteFailed', { message: error.message }));
  }
}
