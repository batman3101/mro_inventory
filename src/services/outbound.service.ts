import { supabase } from '@/lib/supabase';
import type { Outbound } from '@/types/database.types';
import { getOptionalLocationId } from '@/services/locationContext';

export async function getAllOutbound(): Promise<Outbound[]> {
  const locationId = getOptionalLocationId();
  let query = supabase
    .from('outbound')
    .select('*, items(item_code, item_name, unit), departments(department_name)');
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  const { data, error } = await query
    .order('outbound_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`출고 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
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
    throw new Error(`출고 조회 실패: ${error.message}`);
  }

  return {
    ...data,
    item_code: (data as any).items?.item_code ?? '',
    item_name: (data as any).items?.item_name ?? '',
    item_unit: (data as any).items?.unit ?? '',
    department_name: (data as any).departments?.department_name ?? '',
  };
}

export async function generateReferenceNumber(): Promise<string> {
  const now = new Date();
  const yyyymmdd =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const prefix = `OUT-${yyyymmdd}-`;

  const { data, error } = await supabase
    .from('outbound')
    .select('reference_number')
    .like('reference_number', `${prefix}%`)
    .order('reference_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`출고 번호 생성 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return `${prefix}001`;
  }

  const lastRef = data[0].reference_number;
  const lastSeq = parseInt(lastRef.slice(-3), 10);
  const nextSeq = String(lastSeq + 1).padStart(3, '0');

  return `${prefix}${nextSeq}`;
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
    throw new Error(`재고 조회 실패: ${error.message}`);
  }

  return data?.current_quantity ?? 0;
}

export async function createOutbound(
  data: Omit<
    Outbound,
    'outbound_id' | 'created_at' | 'item_code' | 'item_name' | 'department_name' | 'item_unit'
  >
): Promise<Outbound> {
  const currentQty = await checkStock(data.item_id, data.location_id);

  if (currentQty < data.quantity) {
    throw new Error(
      `재고가 부족합니다. 현재 재고: ${currentQty}, 요청: ${data.quantity}`
    );
  }

  const referenceNumber = await generateReferenceNumber();

  const { data: created, error: insertError } = await supabase
    .from('outbound')
    .insert({ ...data, reference_number: referenceNumber })
    .select('*, items(item_code, item_name, unit), departments(department_name)')
    .single();

  if (insertError) {
    throw new Error(`출고 등록 실패: ${insertError.message}`);
  }

  const { error: updateError } = await supabase
    .from('inventory')
    .update({ current_quantity: currentQty - data.quantity })
    .eq('item_id', data.item_id)
    .eq('location_id', data.location_id);

  if (updateError) {
    throw new Error(`재고 차감 실패: ${updateError.message}`);
  }

  return {
    ...created,
    item_code: (created as any).items?.item_code ?? '',
    item_name: (created as any).items?.item_name ?? '',
    item_unit: (created as any).items?.unit ?? '',
    department_name: (created as any).departments?.department_name ?? '',
  };
}

export async function deleteOutbound(id: string): Promise<void> {
  const { error } = await supabase
    .from('outbound')
    .delete()
    .eq('outbound_id', id);

  if (error) {
    throw new Error(`출고 삭제 실패: ${error.message}`);
  }
}
