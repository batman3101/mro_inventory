import { supabase } from '@/lib/supabase';
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
  const { data, error } = await query.order('items(item_code)', { ascending: true });

  if (error) {
    throw new Error(`재고 목록 조회 실패: ${error.message}`);
  }

  return ((data ?? []) as unknown as Array<Inventory & { items: { item_code: string; item_name: string; unit: string; reorder_point: number; min_stock: number } }>).map(
    ({ items, ...inv }) => ({
      ...inv,
      item_code: items?.item_code ?? '',
      item_name: items?.item_name ?? '',
      unit: items?.unit ?? '',
      reorder_point: items?.reorder_point ?? 0,
      min_stock: items?.min_stock ?? 0,
    })
  );
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
    throw new Error(`재고 조회 실패: ${error.message}`);
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
    throw new Error(`재고 수량 수정 실패: ${error.message}`);
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
    throw new Error(`재주문 알림 조회 실패: ${error.message}`);
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
    throw new Error(`알림 확인 처리 실패: ${error.message}`);
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
    throw new Error(`알림 해결 처리 실패: ${error.message}`);
  }
}
