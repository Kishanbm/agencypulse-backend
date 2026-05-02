import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Snowflake API service — custom SQL query results as metrics.
 *
 * API: Snowflake SQL REST API v2
 * Docs: https://docs.snowflake.com/en/developer-guide/sql-api/reference
 *
 * Auth: HTTP Basic (username:password) or key-pair JWT.
 *   We use username:password Basic auth for simplicity (password = accessToken).
 * Base URL: https://{account}.snowflakecomputing.com/api/v2/statements
 *
 * Storage layout:
 *   accessToken       = Snowflake password
 *   externalAccountId = JSON {
 *     "account": "myorg-myaccount",
 *     "user": "READONLY_USER",
 *     "database": "ANALYTICS_DB",
 *     "schema": "PUBLIC",
 *     "warehouse": "COMPUTE_WH",
 *     "query": "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'"
 *   }
 *   The query must return columns: DATE, METRIC_KEY, VALUE.
 *   {from} and {to} placeholders are replaced with dateRange values.
 *
 * Approach:
 *   POST /api/v2/statements → async statement submission
 *   Poll GET /api/v2/statements/{statementHandle} until state = 'success'
 *   Extract rows from the response partition data.
 */
@Injectable()
export class SnowflakeApiService {
  private readonly logger = new Logger(SnowflakeApiService.name);

  async fetchCoreMetrics(
    password: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let account: string;
    let user: string;
    let database: string;
    let schema: string;
    let warehouse: string;
    let queryTemplate: string;

    try {
      const parsed = JSON.parse(accountJson) as {
        account?: string; user?: string; database?: string;
        schema?: string; warehouse?: string; query?: string;
      };
      account       = parsed.account   ?? '';
      user          = parsed.user      ?? '';
      database      = parsed.database  ?? '';
      schema        = parsed.schema    ?? 'PUBLIC';
      warehouse     = parsed.warehouse ?? 'COMPUTE_WH';
      queryTemplate = parsed.query     ?? '';
    } catch {
      throw new BadRequestException('Snowflake: externalAccountId must be JSON {account, user, database, schema, warehouse, query}.');
    }
    if (!account || !user || !database || !queryTemplate) {
      throw new BadRequestException('Snowflake: account, user, database, and query are required.');
    }

    const query       = queryTemplate.replace(/{from}/g, dateRange.from).replace(/{to}/g, dateRange.to);
    const credentials = Buffer.from(`${user}:${password}`).toString('base64');
    const BASE        = `https://${account}.snowflakecomputing.com/api/v2/statements`;
    const headers     = {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    };

    // Submit statement
    const submitResp = await fetchWithRetry(BASE, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        statement:  query,
        timeout:    60,
        database,
        schema,
        warehouse,
        parameters: { TIMESTAMP_OUTPUT_FORMAT: 'YYYY-MM-DD' },
      }),
    });

    if (submitResp.status === 401 || submitResp.status === 403) {
      throw new BadRequestException('Snowflake: authentication failed — check account, user, and password.');
    }
    if (!submitResp.ok) {
      const txt = await submitResp.text().catch(() => '');
      throw new BadRequestException(`Snowflake statement submit failed (HTTP ${submitResp.status}): ${txt.slice(0, 200)}`);
    }

    const submitBody = await submitResp.json() as {
      statementHandle?: string;
      status?: string;
      data?: string[][];
      resultSetMetaData?: { rowType?: Array<{ name?: string }> };
    };

    const handle = submitBody.statementHandle ?? '';
    if (!handle) throw new BadRequestException('Snowflake: no statementHandle returned.');

    // Poll until success or failure
    let status = submitBody.status ?? 'RUNNING';
    let finalBody = submitBody;

    for (let i = 0; i < 30 && status === 'RUNNING'; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetchWithRetry(`${BASE}/${handle}`, { headers });
      if (pollResp.ok) {
        finalBody = await pollResp.json() as typeof submitBody;
        status    = finalBody.status ?? 'RUNNING';
      }
    }

    if (status !== 'success') {
      throw new BadRequestException(`Snowflake query did not complete (status: ${status}).`);
    }

    const colNames = (finalBody.resultSetMetaData?.rowType ?? []).map(c => (c.name ?? '').toUpperCase());
    const dateIdx      = colNames.indexOf('DATE');
    const metricKeyIdx = colNames.indexOf('METRIC_KEY');
    const valueIdx     = colNames.indexOf('VALUE');

    if (dateIdx < 0 || metricKeyIdx < 0 || valueIdx < 0) {
      throw new BadRequestException('Snowflake: query must return columns named DATE, METRIC_KEY, and VALUE.');
    }

    const rows: MetricRowInput[] = [];
    for (const row of finalBody.data ?? []) {
      const date      = String(row[dateIdx]      ?? '').slice(0, 10);
      const metricKey = String(row[metricKeyIdx] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
      const value     = String(row[valueIdx]     ?? '0');
      if (!date || !metricKey) continue;
      rows.push({ metricKey, value, recordedAt: date });
    }
    return rows;
  }
}
