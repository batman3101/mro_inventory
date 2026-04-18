import * as XLSX from 'xlsx';
import i18n from '@/i18n/config';

const COLUMN_KEYS = [
  'itemName',
  'koreanName',
  'vietnameseName',
  'categoryCode',
  'spec',
  'unit',
  'minStock',
  'maxStock',
  'reorderPoint',
  'storageLocation',
  'description',
] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];

function getColumnHeader(key: ColumnKey): string {
  return i18n.t(`excel.templates.itemImport.columns.${key}`);
}

// Generate template for bulk item import
export function downloadItemImportTemplate(): void {
  const headers = COLUMN_KEYS.map(getColumnHeader);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  worksheet['!cols'] = headers.map(() => ({ wch: 15 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    i18n.t('excel.templates.itemImport.sheetName')
  );
  XLSX.writeFile(workbook, i18n.t('excel.templates.itemImport.fileName'));
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

function cellFor(row: Record<string, unknown>, key: ColumnKey): unknown {
  return row[getColumnHeader(key)];
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
  const requiredMsg = i18n.t('excel.validation.required');
  const numberMsg = i18n.t('excel.validation.mustBeNumber');

  const itemNameCell = cellFor(row, 'itemName');
  const unitCell = cellFor(row, 'unit');
  if (!itemNameCell) {
    errors.push({ field: getColumnHeader('itemName'), message: requiredMsg });
  }
  if (!unitCell) {
    errors.push({ field: getColumnHeader('unit'), message: requiredMsg });
  }

  const minStockRaw = cellFor(row, 'minStock');
  const maxStockRaw = cellFor(row, 'maxStock');
  const reorderPointRaw = cellFor(row, 'reorderPoint');

  const minStock =
    minStockRaw !== undefined && minStockRaw !== '' ? Number(minStockRaw) : NaN;
  const maxStock =
    maxStockRaw !== undefined && maxStockRaw !== '' ? Number(maxStockRaw) : NaN;
  const reorderPoint =
    reorderPointRaw !== undefined && reorderPointRaw !== '' ? Number(reorderPointRaw) : NaN;

  if (minStockRaw !== undefined && minStockRaw !== '' && isNaN(minStock)) {
    errors.push({ field: getColumnHeader('minStock'), message: numberMsg });
  }
  if (maxStockRaw !== undefined && maxStockRaw !== '' && isNaN(maxStock)) {
    errors.push({ field: getColumnHeader('maxStock'), message: numberMsg });
  }
  if (reorderPointRaw !== undefined && reorderPointRaw !== '' && isNaN(reorderPoint)) {
    errors.push({ field: getColumnHeader('reorderPoint'), message: numberMsg });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      item_name: String(itemNameCell),
      korean_name: String(cellFor(row, 'koreanName') ?? ''),
      vietnamese_name: String(cellFor(row, 'vietnameseName') ?? ''),
      category_code: String(cellFor(row, 'categoryCode') ?? ''),
      spec: String(cellFor(row, 'spec') ?? ''),
      unit: String(unitCell),
      min_stock: isNaN(minStock) ? 0 : minStock,
      max_stock: isNaN(maxStock) ? 0 : maxStock,
      reorder_point: isNaN(reorderPoint) ? 0 : reorderPoint,
      storage_location: String(cellFor(row, 'storageLocation') ?? ''),
      description: String(cellFor(row, 'description') ?? ''),
    },
  };
}
