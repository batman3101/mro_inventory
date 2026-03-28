import { supabase } from '@/lib/supabase';
import type { Inbound } from '@/types/database.types';

export async function getAllInbound(): Promise<Inbound[]> {
  const { data, error } = await supabase
    .from('inbound')
    .select(
      '*, items(item_code, item_name, unit), suppliers(supplier_name)'
    )
    .order('inbound_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`입고 목록 조회 실패: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    item_code: row.items?.item_code ?? '',
    item_name: row.items?.item_name ?? '',
    item_unit: row.items?.unit ?? '',
    supplier_name: row.suppliers?.supplier_name ?? '',
  }));
}

export async function getInboundById(id: string): Promise<Inbound | null> {
  const { data, error } = await supabase
    .from('inbound')
    .select('*, items(item_code, item_name, unit), suppliers(supplier_name)')
    .eq('inbound_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`입고 조회 실패: ${error.message}`);
  }

  return {
    ...data,
    item_code: (data as any).items?.item_code ?? '',
    item_name: (data as any).items?.item_name ?? '',
    item_unit: (data as any).items?.unit ?? '',
    supplier_name: (data as any).suppliers?.supplier_name ?? '',
  };
}

export async function generateReferenceNumber(): Promise<string> {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const prefix = `IN-${dateStr}-`;

  const { data, error } = await supabase
    .from('inbound')
    .select('reference_number')
    .like('reference_number', `${prefix}%`)
    .order('reference_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`입고번호 생성 실패: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return `${prefix}001`;
  }

  const lastNumber = data[0].reference_number;
  const lastSeq = parseInt(lastNumber.slice(-3), 10);
  const nextSeq = String(lastSeq + 1).padStart(3, '0');

  return `${prefix}${nextSeq}`;
}

export async function createInbound(
  data: Omit<Inbound, 'inbound_id' | 'created_at' | 'reference_number' | 'total_price' | 'item_code' | 'item_name' | 'supplier_name' | 'item_unit'>
): Promise<Inbound> {
  const reference_number = await generateReferenceNumber();
  const total_price = data.quantity * data.unit_price;

  const { data: created, error } = await supabase
    .from('inbound')
    .insert({ ...data, reference_number, total_price })
    .select()
    .single();

  if (error) {
    throw new Error(`입고 등록 실패: ${error.message}`);
  }

  // Update inventory: upsert current_quantity
  const { data: existing, error: invFetchError } = await supabase
    .from('inventory')
    .select('inventory_id, current_quantity')
    .eq('item_id', data.item_id)
    .eq('location_id', data.location_id)
    .maybeSingle();

  if (invFetchError) {
    throw new Error(`재고 조회 실패: ${invFetchError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        current_quantity: existing.current_quantity + data.quantity,
        updated_at: new Date().toISOString(),
        updated_by: data.created_by,
      })
      .eq('inventory_id', existing.inventory_id);

    if (updateError) {
      throw new Error(`재고 수량 업데이트 실패: ${updateError.message}`);
    }
  } else {
    const { error: insertError } = await supabase
      .from('inventory')
      .insert({
        item_id: data.item_id,
        location_id: data.location_id,
        current_quantity: data.quantity,
        last_count_date: new Date().toISOString(),
        storage_location: '',
        updated_by: data.created_by,
      });

    if (insertError) {
      throw new Error(`재고 생성 실패: ${insertError.message}`);
    }
  }

  return getInboundById(created.inbound_id) as Promise<Inbound>;
}

export async function deleteInbound(id: string): Promise<void> {
  const { error } = await supabase
    .from('inbound')
    .delete()
    .eq('inbound_id', id);

  if (error) {
    throw new Error(`입고 삭제 실패: ${error.message}`);
  }
}
