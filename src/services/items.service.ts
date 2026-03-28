import { supabase } from '@/lib/supabase';
import type { Item } from '@/types/database.types';

export async function getAllItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*, categories(category_name)')
    .order('item_code', { ascending: true });

  if (error) {
    throw new Error(`품목 목록 조회 실패: ${error.message}`);
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
    throw new Error(`품목 조회 실패: ${error.message}`);
  }

  return data;
}

export async function generateItemCode(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthPrefix = `MRO-${year}${month}-`;

  const { data, error } = await supabase
    .from('items')
    .select('item_code')
    .like('item_code', `${monthPrefix}%`)
    .order('item_code', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`품목 코드 생성 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return `${monthPrefix}001`;
  }

  const lastCode = data[0].item_code;
  const lastSequence = parseInt(lastCode.slice(-3), 10);
  const nextSequence = String(lastSequence + 1).padStart(3, '0');

  return `${monthPrefix}${nextSequence}`;
}

export async function createItem(
  data: Omit<Item, 'item_id' | 'created_at' | 'updated_at'>
): Promise<Item> {
  const itemCode = await generateItemCode();

  const { data: created, error } = await supabase
    .from('items')
    .insert({ ...data, item_code: itemCode })
    .select()
    .single();

  if (error) {
    throw new Error(`품목 생성 실패: ${error.message}`);
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
    throw new Error(`품목 수정 실패: ${error.message}`);
  }

  return updated;
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('item_id', itemId);

  if (error) {
    throw new Error(`품목 삭제 실패: ${error.message}`);
  }
}

export async function searchItems(query: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or(`item_name.ilike.%${query}%,item_code.ilike.%${query}%`)
    .order('item_code', { ascending: true });

  if (error) {
    throw new Error(`품목 검색 실패: ${error.message}`);
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
    throw new Error(`카테고리별 품목 조회 실패: ${error.message}`);
  }

  return data ?? [];
}
