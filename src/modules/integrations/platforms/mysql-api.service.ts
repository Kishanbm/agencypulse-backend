import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import * as mysql from 'mysql2/promise';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * MySQL API service — custom SQL query results as metrics.
 *
 * Auth: Direct MySQL connection (not HTTP). Uses mysql2 driver.
 * Connection details + query stored in externalAccountId as JSON.
 *
 * Storage layout:
 *   accessToken       = MySQL password (encrypted at rest in IntegrationConnection)
 *   externalAccountId = JSON {
 *     "host": "db.example.com",
 *     "port": 3306,
 *     "database": "analytics",
 *     "user": "readonly_user",
 *     "query": "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'"
 *   }
 *   The query must return columns: date (YYYY-MM-DD), metric_key (string), value (numeric).
 *   {from} and {to} placeholders are replaced with dateRange values.
 *
 * Note: Connection is created per sync, query runs once, connection is destroyed immediately.
 *   Use a read-only DB user — write access is unnecessary and a security risk.
 */
@Injectable()
export class MysqlApiService {
  private readonly logger = new Logger(MysqlApiService.name);

  async fetchCoreMetrics(
    password: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let host: string;
    let port: number;
    let database: string;
    let user: string;
    let queryTemplate: string;

    try {
      const parsed = JSON.parse(accountJson) as {
        host?: string; port?: number; database?: string;
        user?: string; query?: string;
      };
      host          = parsed.host     ?? '';
      port          = parsed.port     ?? 3306;
      database      = parsed.database ?? '';
      user          = parsed.user     ?? '';
      queryTemplate = parsed.query    ?? '';
    } catch {
      throw new BadRequestException('MySQL: externalAccountId must be JSON {host, port, database, user, query}.');
    }
    if (!host || !database || !user || !queryTemplate) {
      throw new BadRequestException('MySQL: host, database, user, and query are required.');
    }

    const query = queryTemplate
      .replace(/{from}/g, dateRange.from)
      .replace(/{to}/g, dateRange.to);

    let connection: mysql.Connection | null = null;
    try {
      connection = await mysql.createConnection({
        host, port, database, user, password,
        connectTimeout: 10000,
        ssl: { rejectUnauthorized: false },
      });

      const [result] = await connection.execute(query);
      const rowsRaw  = result as Array<Record<string, unknown>>;

      const rows: MetricRowInput[] = [];
      for (const row of rowsRaw) {
        const date      = String(row['date']       ?? '').slice(0, 10);
        const metricKey = String(row['metric_key'] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
        const value     = String(row['value']      ?? '0');
        if (!date || !metricKey) continue;
        rows.push({ metricKey, value, recordedAt: date });
      }
      return rows;
    } catch (err) {
      if ((err as Error).message?.includes('Access denied')) {
        throw new BadRequestException('MySQL: access denied — check credentials.');
      }
      if ((err as Error).message?.includes('ENOTFOUND') || (err as Error).message?.includes('ETIMEDOUT')) {
        throw new BadRequestException('MySQL: cannot connect to host — check host/port and firewall rules.');
      }
      throw err;
    } finally {
      await connection?.end().catch(() => undefined);
    }
  }
}
