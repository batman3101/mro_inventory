import * as XLSX from 'xlsx';

// Generate template for bulk item import
export function downloadItemImportTemplate(): void {
  const headers = [
    '소모품명', '한국어명', '베트남어명', '카테고리코드',
    '규격', '단위', '최소재고', '최대재고', '재주문점',
    '보관위치', '설명',
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  worksheet['!cols'] = headers.map(() => ({ wch: 15 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '소모품가져오기');
  XLSX.writeFile(workbook, 'MRO_소모품_가져오기_템플릿.xlsx');
}

interface ValidatedItemRow {
  item_name: string;
  korean_name: string;
  vietnamese_name: string;
  category_code: string;
  spec: string;
  unit: string;
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  storage_location: string;
  description: string;
}

// Validate imported item row
export function validateItemRow(
  row: Record<string, unknown>,
  rowIndex: number
): {
  valid: boolean;
  data?: ValidatedItemRow;
  errors?: Array<{ field: string; message: string }>;
} {
  void rowIndex;
  const errors: Array<{ field: string; message: string }> = [];

  if (!row['소모품명']) {
    errors.push({ field: '소모품명', message: '필수 항목입니다' });
  }
  if (!row['단위']) {
    errors.push({ field: '단위', message: '필수 항목입니다' });
  }

  const minStock = row['최소재고'] !== undefined && row['최소재고'] !== '' ? Number(row['최소재고']) : NaN;
  const maxStock = row['최대재고'] !== undefined && row['최대재고'] !== '' ? Number(row['최대재고']) : NaN;
  const reorderPoint = row['재주문점'] !== undefined && row['재주문점'] !== '' ? Number(row['재주문점']) : NaN;

  if (row['최소재고'] !== undefined && row['최소재고'] !== '' && isNaN(minStock)) {
    errors.push({ field: '최소재고', message: '숫자여야 합니다' });
  }
  if (row['최대재고'] !== undefined && row['최대재고'] !== '' && isNaN(maxStock)) {
    errors.push({ field: '최대재고', message: '숫자여야 합니다' });
  }
  if (row['재주문점'] !== undefined && row['재주문점'] !== '' && isNaN(reorderPoint)) {
    errors.push({ field: '재주문점', message: '숫자여야 합니다' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      item_name: String(row['소모품명']),
      korean_name: String(row['한국어명'] ?? ''),
      vietnamese_name: String(row['베트남어명'] ?? ''),
      category_code: String(row['카테고리코드'] ?? ''),
      spec: String(row['규격'] ?? ''),
      unit: String(row['단위']),
      min_stock: isNaN(minStock) ? 0 : minStock,
      max_stock: isNaN(maxStock) ? 0 : maxStock,
      reorder_point: isNaN(reorderPoint) ? 0 : reorderPoint,
      storage_location: String(row['보관위치'] ?? ''),
      description: String(row['설명'] ?? ''),
    },
  };
}
