import { supabase } from '@/lib/supabase';
import type { ItemPrice } from '@/types/database.types';

export async function getItemPrices(itemId: string): Promise<ItemPrice[]> {
  const { data, error } = await supabase
    .from('item_prices')
    .select('*')
    .eq('item_id', itemId)
    .order('effective_from', { ascending: false });

  if (error) {
    throw new Error(`품목 단가 목록 조회 실패: ${error.message}`);
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
    throw new Error(`현재 단가 조회 실패: ${error.message}`);
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
      throw new Error(`기존 단가 비활성화 실패: ${updateError.message}`);
    }
  }

  const { data: created, error } = await supabase
    .from('item_prices')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(`품목 단가 생성 실패: ${error.message}`);
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
    throw new Error(`품목 단가 수정 실패: ${error.message}`);
  }

  return updated;
}

export async function deleteItemPrice(priceId: string): Promise<void> {
  const { error } = await supabase
    .from('item_prices')
    .delete()
    .eq('price_id', priceId);

  if (error) {
    throw new Error(`품목 단가 삭제 실패: ${error.message}`);
  }
}
