import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Category } from '@/types/database.types';

export async function getAllCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('category_code', { ascending: true });

  if (error) {
    throw new Error(i18n.t('errors.categories.fetchFailed', { message: error.message }));
  }
  return data ?? [];
}

export async function createCategory(
  data: Omit<Category, 'category_id' | 'created_at'>
): Promise<Category> {
  const { data: created, error } = await supabase
    .from('categories')
    .insert(data)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.categories.createFailed', { message: error.message }));
  }
  return created;
}

export async function updateCategory(
  categoryId: string,
  data: Partial<Omit<Category, 'category_id' | 'created_at'>>
): Promise<Category> {
  const { data: updated, error } = await supabase
    .from('categories')
    .update(data)
    .eq('category_id', categoryId)
    .select()
    .single();

  if (error) {
    throw new Error(i18n.t('errors.categories.updateFailed', { message: error.message }));
  }
  return updated;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('category_id', categoryId);

  if (error) {
    throw new Error(i18n.t('errors.categories.deleteFailed', { message: error.message }));
  }
}
