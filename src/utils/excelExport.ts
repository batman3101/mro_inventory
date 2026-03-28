import * as XLSX from 'xlsx';

interface ExportOptions {
  data: Record<string, unknown>[];
  fileName: string;
  sheetName?: string;
}

export function exportToExcel({ data, fileName, sheetName = 'Sheet1' }: ExportOptions): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
