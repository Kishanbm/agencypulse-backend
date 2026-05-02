import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { Client } from 'pg';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Amazon Redshift API service — custom SQL query results as metrics.
 *
 * Auth: Direct PostgreSQL connection via Redshift endpoint. Uses `pg` driver.
 *   Redshift uses the PostgreSQL wire protocol on port 5439.
 *
 * Storage layout:
 *   accessToken       = Redshift password (encrypted at rest)
 *   externalAccountId = JSON {
 *     "host": "mycluster.xxxx.us-east-1.redshift.amazonaws.com",
 *     "port": 5439,
 *     "database": "analytics",
 *     "user": "readonly_user",
 *     "query": "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'"
 *   }
 *   The query must return columns: date (YYYY-MM-DD), metric_key (string), value (numeric).
 *   {from} and {to} placeholders are replaced with dateRange values.
 *
 * Note: Use a read-only Redshift user. SSL is enforced by default on Redshift clusters.
 */
@Injectable()
export class RedshiftApiService {
  private readonly logger = new Logger(RedshiftApiService.name);

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
      port          = parsed.port     ?? 5439;
      database      = parsed.database ?? '';
      user          = parsed.user     ?? '';
      queryTemplate = parsed.query    ?? '';
    } catch {
      throw new BadRequestException('Redshift: externalAccountId must be JSON {host, port, database, user, query}.');
    }
    if (!host || !database || !user || !queryTemplate) {
      throw new BadRequestException('Redshift: host, database, user, and query are required.');
    }

    const query = queryTemplate
      .replace(/{from}/g, dateRange.from)
      .replace(/{to}/g, dateRange.to);

    const client = new Client({
      host, port, database, user, password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    });

    try {
      await client.connect();
      const result = await client.query(query);

      const rows: MetricRowInput[] = [];
      for (const row of result.rows) {
        const date      = String(row['date']       ?? '').slice(0, 10);
        const metricKey = String(row['metric_key'] ?? '').trim().toLowerCase().replace(/\s+/g, '_');
        const value     = String(row['value']      ?? '0');
        if (!date || !metricKey) continue;
        rows.push({ metricKey, value, recordedAt: date });
      }
      return rows;
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('password authentication') || msg.includes('authentication failed')) {
        throw new BadRequestException('Redshift: authentication failed — check credentials.');
      }
      if (msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT') || msg.includes('connect ECONNREFUSED')) {
        throw new BadRequestException('Redshift: cannot connect to cluster — check host/port and VPC security group rules.');
      }
      throw err;
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
