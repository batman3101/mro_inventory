import { supabase } from '@/lib/supabase';
import i18n from '@/i18n/config';
import type { Inventory, ReorderAlert } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';

export interface InventoryWithItem extends Inventory {
  item_code: string;
  item_name: string;
  unit: string;
  reorder_point: number;
  min_stock: number;
}

export interface ReorderAlertWithItem extends ReorderAlert {
  item_name: string;
  item_code: string;
}

export async function getAllInventory(): Promise<InventoryWithItem[]> {
  const locationId = getOptionalLocationId();
  let query = supabase
    .from('inventory')
    .select('*, items(item_code, item_name, unit, reorder_point, min_stock)');
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  // PostgREST embedded-resource order ('items(item_code)') was rejecting with
  // 400 on this project's schema. Sort client-side instead — dataset is small
  // (one row per item per location) and this avoids depending on FK cache.
  const { data, error } = await query;

  if (error) {
    throw new Error(i18n.t('errors.inventory.fetchFailed', { message: error.message }));
  }

  return ((data ?? []) as unknown as Array<Inventory & { items: { item_code: string; item_name: string; unit: string; reorder_point: number; min_stock: number } }>)
    .map(({ items, ...inv }) => ({
      ...inv,
      item_code: items?.item_code ?? '',
      item_name: items?.item_name ?? '',
      unit: items?.unit ?? '',
      reorder_point: items?.reorder_point ?? 0,
      min_stock: items?.min_stock ?? 0,
    }))
    .sort((a, b) => a.item_code.localeCompare(b.item_code));
}

export async function getInventoryByItemId(itemId: string): Promise<InventoryWithItem | null> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, items(item_code, item_name, unit, reorder_point, min_stock)')
    .eq('item_id', itemId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(i18n.t('errors.inventory.getByIdFailed', { message: error.message }));
  }

  const { items, ...inv } = data as unknown as Inventory & { items: { item_code: string; item_name: string; unit: string; reorder_point: number; min_stock: number } };
  return {
    ...inv,
    item_code: items?.item_code ?? '',
    item_name: items?.item_name ?? '',
    unit: items?.unit ?? '',
    reorder_point: items?.reorder_point ?? 0,
    min_stock: items?.min_stock ?? 0,
  };
}

// Bulk import path: sets the absolute current_quantity (not a delta) for an
// (item, location) pair. Inserts a new inventory row when none exists.
export async function upsertInventoryQuantity(
  itemId: string,
  locationId: string,
  newQuantity: number,
  storageLocation: string,
  updatedBy: string,
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('inventory')
    .select('inventory_id')
    .eq('item_id', itemId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(i18n.t('errors.inventory.deltaFetchFailed', { message: fetchErr.message }));
  }

  if (existing) {
    // Bulk import is semantically a fresh stock count — refresh
    // last_count_date so the Inventory page's "최근 업데이트" column reflects
    // when the user actually counted.
    const updateData: Record<string, unknown> = {
      current_quantity: newQuantity,
      last_count_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    };
    if (storageLocation) updateData.storage_location = storageLocation;

    const { error: updErr } = await supabase
      .from('inventory')
      .update(updateData)
      .eq('inventory_id', existing.inventory_id);
    if (updErr) {
      throw new Error(i18n.t('errors.inventory.deltaUpdateFailed', { message: updErr.message }));
    }
  } else {
    const { error: insErr } = await supabase
      .from('inventory')
      .insert({
        item_id: itemId,
        location_id: locationId,
        current_quantity: newQuantity,
        last_count_date: new Date().toISOString(),
        storage_location: storageLocation,
        updated_by: updatedBy,
      });
    if (insErr) {
      throw new Error(i18n.t('errors.inventory.deltaCreateFailed', { message: insErr.message }));
    }
  }
}

export async function updateQuantity(
  inventoryId: string,
  newQuantity: number,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .update({ current_quantity: newQuantity, updated_by: updatedBy })
    .eq('inventory_id', inventoryId);

  if (error) {
    throw new Error(i18n.t('errors.inventory.updateQuantityFailed', { message: error.message }));
  }
}

export async function getReorderAlerts(): Promise<ReorderAlertWithItem[]> {
  const locationId = getOptionalLocationId();
  let query = supabase
    .from('reorder_alerts')
    .select('*, items(item_name, item_code)')
    .eq('status', 'OPEN');
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(i18n.t('errors.inventory.alertsFetchFailed', { message: error.message }));
  }

  return ((data ?? []) as unknown as Array<ReorderAlert & { items: { item_name: string; item_code: string } }>).map(
    ({ items, ...alert }) => ({
      ...alert,
      item_name: items?.item_name ?? '',
      item_code: items?.item_code ?? '',
    })
  );
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('reorder_alerts')
    .update({ status: 'ACKNOWLEDGED' })
    .eq('alert_id', alertId);

  if (error) {
    throw new Error(i18n.t('errors.inventory.acknowledgeAlertFailed', { message: error.message }));
  }
}

export async function resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('reorder_alerts')
    .update({
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('alert_id', alertId);

  if (error) {
    throw new Error(i18n.t('errors.inventory.resolveAlertFailed', { message: error.message }));
  }
}
