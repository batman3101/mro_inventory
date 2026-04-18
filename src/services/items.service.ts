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
    throw new Error(i18n.t('errors.items.generateCodeFailed', { message: error.message }));
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
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('item_id', itemId);

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
