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

// Return every possible header text for this column across all supported
// locales. Lets bulk-import accept a file downloaded under one UI language
// (e.g. Vietnamese template "Mã vật tư") even when the user is currently in
// the other UI language (e.g. Korean "소모품코드").
function getAllHeaders(key: ColumnKey): string[] {
  const headers = new Set<string>();
  headers.add(i18n.t(`excel.templates.itemImport.columns.${key}`));
  for (const lng of ['ko', 'vi']) {
    headers.add(i18n.t(`excel.templates.itemImport.columns.${key}`, { lng }));
  }
  return Array.from(headers);
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
  for (const header of getAllHeaders(key)) {
    const v = row[header];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  // Last fallback: empty string from any matching header (so column existence
  // is detected even with blank cells).
  for (const header of getAllHeaders(key)) {
    if (header in row) return row[header];
  }
  return undefined;
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

// =============================================================================
// Supplier bulk import — separate from items
// =============================================================================

const SUPPLIER_COLUMN_KEYS = [
  'supplierCode',
  'supplierName',
  'contactPerson',
  'email',
  'phone',
  'address',
  'country',
  'website',
] as const;

type SupplierColumnKey = (typeof SUPPLIER_COLUMN_KEYS)[number];

function getSupplierHeader(key: SupplierColumnKey): string {
  return i18n.t(`excel.templates.supplierImport.columns.${key}`);
}

function getAllSupplierHeaders(key: SupplierColumnKey): string[] {
  const headers = new Set<string>();
  headers.add(i18n.t(`excel.templates.supplierImport.columns.${key}`));
  for (const lng of ['ko', 'vi']) {
    headers.add(i18n.t(`excel.templates.supplierImport.columns.${key}`, { lng }));
  }
  return Array.from(headers);
}

function supplierCellOf(row: Record<string, unknown>, key: SupplierColumnKey): unknown {
  for (const header of getAllSupplierHeaders(key)) {
    const v = row[header];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export function downloadSupplierImportTemplate(): void {
  const headers = SUPPLIER_COLUMN_KEYS.map(getSupplierHeader);
  const example: Record<string, string> = {};
  headers.forEach((h) => { example[h] = ''; });
  example[getSupplierHeader('supplierCode')] = 'SUP-001';
  example[getSupplierHeader('supplierName')] = 'Sample Supplier Co.';
  example[getSupplierHeader('contactPerson')] = 'Mr. Kim';
  example[getSupplierHeader('email')] = 'contact@example.com';
  example[getSupplierHeader('phone')] = '+84 28 0000 0000';
  example[getSupplierHeader('country')] = 'Vietnam';

  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, i18n.t('excel.templates.supplierImport.sheetName'));
  XLSX.writeFile(wb, i18n.t('excel.templates.supplierImport.fileName'));
}

export interface ParsedSupplierRow {
  supplierCode: string;
  supplierName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  website: string;
}

export function parseSupplierRow(
  row: Record<string, unknown>
): { ok: true; data: ParsedSupplierRow } | { ok: false; error: string } {
  const supplierCode = String(supplierCellOf(row, 'supplierCode') ?? '').trim();
  const supplierName = String(supplierCellOf(row, 'supplierName') ?? '').trim();

  if (!supplierCode) return { ok: false, error: i18n.t('suppliers.bulkErrorCodeRequired') };
  if (!supplierName) return { ok: false, error: i18n.t('suppliers.bulkErrorNameRequired') };

  return {
    ok: true,
    data: {
      supplierCode,
      supplierName,
      contactPerson: String(supplierCellOf(row, 'contactPerson') ?? '').trim(),
      email: String(supplierCellOf(row, 'email') ?? '').trim(),
      phone: String(supplierCellOf(row, 'phone') ?? '').trim(),
      address: String(supplierCellOf(row, 'address') ?? '').trim(),
      country: String(supplierCellOf(row, 'country') ?? '').trim(),
      website: String(supplierCellOf(row, 'website') ?? '').trim(),
    },
  };
}

// =============================================================================
// Inventory bulk import template — separate from items
// =============================================================================

const INVENTORY_COLUMN_KEYS = [
  'itemCode',
  'currentQuantity',
  'storageLocation',
] as const;

type InventoryColumnKey = (typeof INVENTORY_COLUMN_KEYS)[number];

function getInventoryHeader(key: InventoryColumnKey, lng?: string): string {
  return i18n.t(`excel.templates.inventoryImport.columns.${key}`, lng ? { lng } : undefined);
}

// Forced-language download: lets the page expose both KO and VI buttons
// regardless of the active UI language so users can pick the locale that
// matches their excel workflow.
export function downloadInventoryImportTemplate(lng?: 'ko' | 'vi'): void {
  const headers = INVENTORY_COLUMN_KEYS.map((k) => getInventoryHeader(k, lng));
  const example: Record<string, string | number> = {};
  headers.forEach((h) => { example[h] = ''; });
  example[getInventoryHeader('itemCode', lng)] = 'SAMPLE-001';
  example[getInventoryHeader('currentQuantity', lng)] = 100;
  example[getInventoryHeader('storageLocation', lng)] = 'A-01';

  const ws = XLSX.utils.json_to_sheet([example], { header: headers });
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    ws,
    i18n.t('excel.templates.inventoryImport.sheetName', lng ? { lng } : undefined)
  );
  XLSX.writeFile(wb, i18n.t('excel.templates.inventoryImport.fileName', lng ? { lng } : undefined));
}

function getAllInventoryHeaders(key: InventoryColumnKey): string[] {
  const headers = new Set<string>();
  headers.add(i18n.t(`excel.templates.inventoryImport.columns.${key}`));
  for (const lng of ['ko', 'vi']) {
    headers.add(i18n.t(`excel.templates.inventoryImport.columns.${key}`, { lng }));
  }
  return Array.from(headers);
}

function inventoryCellOf(row: Record<string, unknown>, key: InventoryColumnKey): unknown {
  for (const header of getAllInventoryHeaders(key)) {
    const v = row[header];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export interface ParsedInventoryRow {
  itemCode: string;
  currentQuantity: number;
  storageLocation: string;
}

export function parseInventoryRow(
  row: Record<string, unknown>
): { ok: true; data: ParsedInventoryRow } | { ok: false; error: string } {
  const itemCode = String(inventoryCellOf(row, 'itemCode') ?? '').trim();
  if (!itemCode) return { ok: false, error: i18n.t('inventory.bulkErrorItemCodeRequired') };

  const rawQty = inventoryCellOf(row, 'currentQuantity');
  if (rawQty === undefined || rawQty === null || rawQty === '') {
    return { ok: false, error: i18n.t('inventory.bulkErrorQuantityRequired') };
  }
  const qty = Number(rawQty);
  if (!Number.isFinite(qty) || qty < 0) {
    return { ok: false, error: i18n.t('inventory.bulkErrorInvalidQuantity') };
  }

  return {
    ok: true,
    data: {
      itemCode,
      currentQuantity: qty,
      storageLocation: String(inventoryCellOf(row, 'storageLocation') ?? '').trim(),
    },
  };
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
