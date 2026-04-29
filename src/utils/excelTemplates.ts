import * as XLSX from 'xlsx';
import i18n from '@/i18n/config';

// B안 컬럼 순서: 사용자가 자주 작성하는 핵심 정보 먼저 → 부수 정보 뒤로.
// itemCode = 사내코드 = 소모품코드 (사용자 입력, UNIQUE).
const COLUMN_KEYS = [
  'itemCode',
  'itemName',
  'categoryName',
  'unit',
  'unitPrice',
  'currency',
  'supplierName',
  'effectiveFrom',
  'spec',
  'koreanName',
  'vietnameseName',
  'minStock',
  'maxStock',
  'reorderPoint',
  'storageLocation',
  'description',
] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];

export function getColumnHeader(key: ColumnKey): string {
  return i18n.t(`excel.templates.itemImport.columns.${key}`);
}

export const ITEM_IMPORT_COLUMN_KEYS = COLUMN_KEYS;

// Two example rows ship in the template so the two main usage modes are
// self-documenting:
//   row 1 — create a new item with an initial price (item_code blank)
//   row 2 — add a new price to an existing item (item_code filled, only
//           pricing columns populated)
function buildExampleRows(): Record<string, string | number>[] {
  const headers = COLUMN_KEYS.map(getColumnHeader);
  const today = new Date().toISOString().slice(0, 10);

  const blank = (): Record<string, string | number> => {
    const r: Record<string, string | number> = {};
    headers.forEach((h) => { r[h] = ''; });
    return r;
  };

  const newItemRow = blank();
  newItemRow[getColumnHeader('itemCode')] = 'SAMPLE-001';
  newItemRow[getColumnHeader('itemName')] = 'Sample Bolt M8';
  newItemRow[getColumnHeader('categoryName')] = '';
  newItemRow[getColumnHeader('unit')] = 'EA';
  newItemRow[getColumnHeader('unitPrice')] = 5000;
  newItemRow[getColumnHeader('currency')] = 'VND';
  newItemRow[getColumnHeader('supplierName')] = '';
  newItemRow[getColumnHeader('effectiveFrom')] = today;
  newItemRow[getColumnHeader('spec')] = 'M8 x 20';
  newItemRow[getColumnHeader('koreanName')] = '샘플 볼트';
  newItemRow[getColumnHeader('vietnameseName')] = 'Bu lông mẫu';
  newItemRow[getColumnHeader('minStock')] = 50;
  newItemRow[getColumnHeader('maxStock')] = 200;
  newItemRow[getColumnHeader('reorderPoint')] = 100;
  newItemRow[getColumnHeader('storageLocation')] = 'A-01';

  const priceUpdateRow = blank();
  priceUpdateRow[getColumnHeader('itemCode')] = 'SAMPLE-001';
  priceUpdateRow[getColumnHeader('unitPrice')] = 5500;
  priceUpdateRow[getColumnHeader('currency')] = 'VND';
  priceUpdateRow[getColumnHeader('effectiveFrom')] = today;

  return [newItemRow, priceUpdateRow];
}

export function downloadItemImportTemplate(): void {
  const headers = COLUMN_KEYS.map(getColumnHeader);
  const rows = buildExampleRows();
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  worksheet['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    i18n.t('excel.templates.itemImport.sheetName')
  );
  XLSX.writeFile(workbook, i18n.t('excel.templates.itemImport.fileName'));
}

export interface ParsedItemRow {
  itemCode: string;
  itemName: string;
  koreanName: string;
  vietnameseName: string;
  categoryName: string;
  spec: string;
  unit: string;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  storageLocation: string;
  description: string;
  unitPrice: number | null;
  currency: string;
  supplierName: string;
  effectiveFrom: string | null;
}

export function cellOf(row: Record<string, unknown>, key: ColumnKey): unknown {
  return row[getColumnHeader(key)];
}

export function parseExcelDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function toNumber(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseItemRow(
  row: Record<string, unknown>
): { ok: true; data: ParsedItemRow } | { ok: false; error: string } {
  const itemCode = String(cellOf(row, 'itemCode') ?? '').trim();
  const itemName = String(cellOf(row, 'itemName') ?? '').trim();
  const unit = String(cellOf(row, 'unit') ?? '').trim();

  // For new-item rows we need name + unit; price-only updates skip these
  // because the row only carries pricing for an existing itemCode.
  const isPriceOnly = !!itemCode && !itemName && !unit;
  if (!isPriceOnly) {
    if (!itemCode) return { ok: false, error: i18n.t('items.bulkErrorItemCodeRequired') };
    if (!itemName) return { ok: false, error: i18n.t('items.bulkErrorItemNameRequired') };
    if (!unit) return { ok: false, error: i18n.t('items.bulkErrorUnitRequired') };
  }

  const rawEff = cellOf(row, 'effectiveFrom');
  let effectiveFrom: string | null = null;
  if (rawEff !== undefined && rawEff !== null && rawEff !== '') {
    effectiveFrom = parseExcelDate(rawEff);
    if (!effectiveFrom) return { ok: false, error: i18n.t('items.bulkErrorInvalidDate') };
  }

  const unitPrice = toNullableNumber(cellOf(row, 'unitPrice'));
  if (unitPrice !== null && unitPrice < 0)
    return { ok: false, error: i18n.t('items.bulkErrorInvalidPrice') };

  return {
    ok: true,
    data: {
      itemCode,
      itemName,
      koreanName: String(cellOf(row, 'koreanName') ?? '').trim(),
      vietnameseName: String(cellOf(row, 'vietnameseName') ?? '').trim(),
      categoryName: String(cellOf(row, 'categoryName') ?? '').trim(),
      spec: String(cellOf(row, 'spec') ?? '').trim(),
      unit,
      minStock: toNumber(cellOf(row, 'minStock')),
      maxStock: toNumber(cellOf(row, 'maxStock')),
      reorderPoint: toNumber(cellOf(row, 'reorderPoint')),
      storageLocation: String(cellOf(row, 'storageLocation') ?? '').trim(),
      description: String(cellOf(row, 'description') ?? '').trim(),
      unitPrice,
      currency: String(cellOf(row, 'currency') ?? 'VND').trim() || 'VND',
      supplierName: String(cellOf(row, 'supplierName') ?? '').trim(),
      effectiveFrom,
    },
  };
}
