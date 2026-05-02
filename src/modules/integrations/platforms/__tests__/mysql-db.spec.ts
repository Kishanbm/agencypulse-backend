import './helpers/mock-db';
import { mockMysqlResult } from './helpers/mock-db';
import { MysqlApiService } from '../mysql-api.service';
import { rows } from '../__fixtures__/mysql-db.fixture';

const externalAccountId = JSON.stringify({
  host: 'db.test.com',
  port: 3306,
  database: 'analytics',
  user: 'test',
  query: "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'",
});
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('MysqlApiService', () => {
  let service: MysqlApiService;

  beforeEach(() => {
    service = new MysqlApiService();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockMysqlResult(rows);
    const result = await service.fetchCoreMetrics('pass', externalAccountId, dateRange);
    expect(result.length).toBeGreaterThan(0);
    const keys = result.map(r => r.metricKey);
    expect(keys).toContain('sessions');
    expect(keys).toContain('conversions');
    result.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    result.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when query returns no rows', async () => {
    mockMysqlResult([]);
    const result = await service.fetchCoreMetrics('pass', externalAccountId, dateRange);
    expect(result).toEqual([]);
  });

  it('null fields — does not throw when row fields are null', async () => {
    mockMysqlResult([{ date: '2024-01-15', metric_key: null, value: null }]);
    await expect(
      service.fetchCoreMetrics('pass', externalAccountId, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws when MySQL returns access denied', async () => {
    const mysql2 = require('mysql2/promise');
    mysql2.createConnection.mockRejectedValueOnce(
      Object.assign(new Error('Access denied for user'), { code: 'ER_ACCESS_DENIED_ERROR' }),
    );
    await expect(
      service.fetchCoreMetrics('wrong-pass', externalAccountId, dateRange),
    ).rejects.toThrow();
  });

  it('connection error — throws on ENOTFOUND', async () => {
    const mysql2 = require('mysql2/promise');
    mysql2.createConnection.mockRejectedValueOnce(
      Object.assign(new Error('ENOTFOUND db.test.com'), { code: 'ENOTFOUND' }),
    );
    await expect(
      service.fetchCoreMetrics('pass', externalAccountId, dateRange),
    ).rejects.toThrow();
  });
});
