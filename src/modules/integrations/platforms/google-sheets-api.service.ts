import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Google Sheets API service — custom metrics from a configured spreadsheet.
 *
 * API: Google Sheets API v4
 * Docs: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (GOOGLE_SHEETS in OAUTH_PLATFORM_CONFIGS).
 *   Requires spreadsheets.readonly scope.
 * Base URL: https://sheets.googleapis.com/v4
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = JSON {
 *     "spreadsheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
 *     "range": "Sheet1!A:C",
 *     "dateColumn": 0,     // 0-indexed column index for the date
 *     "metricKeyColumn": 1, // 0-indexed column for metric key
 *     "valueColumn": 2     // 0-indexed column for numeric value
 *   }
 *
 * Approach:
 *   GET /spreadsheets/{spreadsheetId}/values/{range}
 *   Returns a 2D array of values. First row is assumed to be headers (skipped).
 *   Filters rows where dateColumn value falls within dateRange.
 *   Each matching row emits a MetricRowInput using the configured column mapping.
 *
 * This is a "bring your own data" integration for agencies with custom reporting data in Sheets.
 */
@Injectable()
export class GoogleSheetsApiService {
  private readonly logger = new Logger(GoogleSheetsApiService.name);
  private readonly BASE = 'https://sheets.googleapis.com/v4';

  async fetchCoreMetrics(
    accessToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let spreadsheetId: string;
    let range: string;
    let dateCol: number;
    let metricKeyCol: number;
    let valueCol: number;

    try {
      const parsed    = JSON.parse(accountJson) as {
        spreadsheetId?: string;
        range?: string;
        dateColumn?: number;
        metricKeyColumn?: number;
        valueColumn?: number;
      };
      spreadsheetId = parsed.spreadsheetId ?? '';
      range         = parsed.range          ?? 'Sheet1!A:C';
      dateCol       = parsed.dateColumn      ?? 0;
      metricKeyCol  = parsed.metricKeyColumn ?? 1;
      valueCol      = parsed.valueColumn     ?? 2;
    } catch {
      throw new BadRequestException('Google Sheets: externalAccountId must be JSON {spreadsheetId, range, dateColumn, metricKeyColumn, valueColumn}.');
    }
    if (!spreadsheetId) {
      throw new BadRequestException('Google Sheets: spreadsheetId is required.');
    }

    const encodedRange = encodeURIComponent(range);
    const resp = await fetchWithRetry(
      `${this.BASE}/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Google Sheets OAuth token is invalid or lacks spreadsheets.readonly scope.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Google Sheets API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as { values?: string[][] };
    const rows_data = body.values ?? [];

    const rows: MetricRowInput[] = [];
    // Skip header row (index 0)
    for (let i = 1; i < rows_data.length; i++) {
      const row = rows_data[i];
      const dateVal      = row[dateCol]       ?? '';
      const metricKey    = row[metricKeyCol]  ?? '';
      const valueStr     = row[valueCol]      ?? '';

      if (!dateVal || !metricKey || !valueStr) continue;

      // Filter by date range (row date must be >= from and <= to)
      if (dateVal < dateRange.from || dateVal > dateRange.to) continue;

      const numericVal = safeFloat(valueStr);
      if (numericVal === 0 && valueStr.trim() !== '0') continue;

      rows.push({
        metricKey:   metricKey.trim().toLowerCase().replace(/\s+/g, '_'),
        value:       String(numericVal),
        recordedAt:  dateVal.slice(0, 10),
      });
    }
    return rows;
  }
}
