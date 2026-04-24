import { Response } from 'express';
import { MetricPeriodRow } from '../../metrics/dto/query-metrics.dto';

/** FIX #6: Stream CSV row-by-row — never holds all data in memory as a string. */
export function streamCsv(
  res: Response,
  filename: string,
  rows: MetricPeriodRow[],
  metricKeys: string[],
): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}.csv"`);
  res.setHeader('Transfer-Encoding', 'chunked');

  // Header row
  res.write(['Date', ...metricKeys].join(',') + '\r\n');

  // Data rows — written one at a time
  for (const row of rows) {
    const values = metricKeys.map(k => {
      const v = row.metrics[k] ?? 0;
      return typeof v === 'number' ? v.toString() : `"${String(v).replace(/"/g, '""')}"`;
    });
    res.write([row.period, ...values].join(',') + '\r\n');
  }

  res.end();
}

export function buildCsvSummaryBuffer(
  metrics: Record<string, number>,
  filename: string,
): { buffer: string; filename: string } {
  const keys = Object.keys(metrics);
  const header = keys.join(',');
  const values = keys.map(k => metrics[k] ?? 0).join(',');
  return { buffer: header + '\r\n' + values + '\r\n', filename: sanitizeFilename(filename) };
}

// FIX (filename safety): strip spaces and special chars
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_.]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 200);
}
