import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { ItemPrice } from '@/types/database.types';

export async function getItemPrices(itemId: string): Promise<ItemPrice[]> {
  const { data, error } = await supabase
    .from('item_prices')
    .select('*')
    .eq('item_id', itemId)
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

export async function createItemPrice(
  data: Omit<ItemPrice, 'price_id' | 'created_at' | 'supplier_name' | 'source'>
): Promise<ItemPrice> {
  if (data.is_current) {
    const { error: updateError } = await supabase
      .from('item_prices')
      .update({ is_current: false })
      .eq('item_id', data.item_id);

    if (updateError) {
      throw new Error(i18n.t('errors.itemPrice.deactivateCurrentFailed', { message: updateError.message }));
    }
  }

  const { data: created, error } = await supabase
    .from('item_prices')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.itemPrice.createFailed', { message: error.message }));
  }

  return created;
}

export async function updateItemPrice(
  priceId: string,
  data: Partial<Omit<ItemPrice, 'price_id' | 'created_at' | 'supplier_name' | 'source'>>
): Promise<ItemPrice> {
  const { data: updated, error } = await supabase
    .from('item_prices')
    .update(data)
    .eq('price_id', priceId)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.itemPrice.updateFailed', { message: error.message }));
  }

  return updated;
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
