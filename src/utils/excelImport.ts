import * as XLSX from 'xlsx';

interface ImportResult<T> {
  data: T[];
  errors: Array<{ row: number; field: string; message: string }>;
  totalRows: number;
}

export async function importFromExcel<T>(
  file: File,
  validator: (
    row: Record<string, unknown>,
    rowIndex: number
  ) => {
    valid: boolean;
    data?: T;
    errors?: Array<{ field: string; message: string }>;
  }
): Promise<ImportResult<T>> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  const data: T[] = [];
  const errors: Array<{ row: number; field: string; message: string }> = [];

  rows.forEach((row, index) => {
    const result = validator(row, index);
    if (result.valid && result.data !== undefined) {
      data.push(result.data);
    } else if (result.errors) {
      result.errors.forEach((err) => {
        errors.push({ row: index + 2, field: err.field, message: err.message });
      });
    }
  });

  return { data, errors, totalRows: rows.length };
}
