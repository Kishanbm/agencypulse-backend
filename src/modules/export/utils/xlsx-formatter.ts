import * as ExcelJS from 'exceljs';
import { MetricPeriodRow } from '../../metrics/dto/query-metrics.dto';
import { sanitizeFilename } from './csv-formatter';

const HEADER_COLOR = 'FF3B82F6'; // default agency blue

export async function buildXlsxBuffer(
  rows: MetricPeriodRow[],
  summaryMetrics: Record<string, number>,
  metricKeys: string[],
  sheetTitle: string,
  primaryColor?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const workbook = new ExcelJS.Workbook();
  const headerFill = primaryColor
    ? primaryColor.replace('#', 'FF')
    : HEADER_COLOR;

  // ─── Sheet 1: Time-series data ──────────────────────────────────────────────
  const dataSheet = workbook.addWorksheet('Data');
  const dataHeaders = ['Date', ...metricKeys];
  dataSheet.addRow(dataHeaders);

  // Style header row
  const headerRow = dataSheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
  });
  headerRow.commit();

  // FIX #6: add rows one at a time (streaming-style in memory)
  for (const row of rows) {
    const values = metricKeys.map(k => row.metrics[k] ?? 0);
    dataSheet.addRow([row.period, ...values]);
  }

  // Auto-fit column widths
  dataSheet.columns.forEach((col, i) => {
    col.width = i === 0 ? 14 : Math.max(12, (metricKeys[i - 1]?.length ?? 0) + 4);
  });

  // ─── Sheet 2: Summary ────────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.addRow(['Metric', 'Total']);
  const sumHeader = summarySheet.getRow(1);
  sumHeader.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
  });
  sumHeader.commit();

  for (const key of metricKeys) {
    summarySheet.addRow([key, summaryMetrics[key] ?? 0]);
  }
  summarySheet.columns = [{ width: 20 }, { width: 15 }];

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return { buffer, filename: sanitizeFilename(sheetTitle) };
}
