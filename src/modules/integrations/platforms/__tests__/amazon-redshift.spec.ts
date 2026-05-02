import './helpers/mock-db';
import { mockPgResult } from './helpers/mock-db';
import { RedshiftApiService } from '../redshift-api.service';
import { rows } from '../__fixtures__/amazon-redshift.fixture';

const externalAccountId = JSON.stringify({
  host: 'mycluster.xxxx.us-east-1.redshift.amazonaws.com',
  port: 5439,
  database: 'analytics',
  user: 'test',
  query: "SELECT date, metric_key, value FROM metrics WHERE date BETWEEN '{from}' AND '{to}'",
});
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('RedshiftApiService', () => {
  let service: RedshiftApiService;

  beforeEach(() => {
    service = new RedshiftApiService();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockPgResult(rows);
    const result = await service.fetchCoreMetrics('pass', externalAccountId, dateRange);
    expect(result.length).toBeGreaterThan(0);
    const keys = result.map(r => r.metricKey);
    expect(keys).toContain('ad_spend');
    expect(keys).toContain('impressions');
    result.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    result.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when query returns no rows', async () => {
    mockPgResult([]);
    const result = await service.fetchCoreMetrics('pass', externalAccountId, dateRange);
    expect(result).toEqual([]);
  });

  it('null fields — does not throw when row fields are null', async () => {
    mockPgResult([{ date: '2024-01-15', metric_key: null, value: null }]);
    await expect(
      service.fetchCoreMetrics('pass', externalAccountId, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws when pg returns authentication failed', async () => {
    const pg = require('pg');
    pg.Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('password authentication failed for user "test"')),
      query: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    }));
    await expect(
      service.fetchCoreMetrics('wrong-pass', externalAccountId, dateRange),
    ).rejects.toThrow();
  });

  it('connection error — throws on ENOTFOUND', async () => {
    const pg = require('pg');
    pg.Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(
        Object.assign(new Error('ENOTFOUND mycluster.xxxx.us-east-1.redshift.amazonaws.com'), { code: 'ENOTFOUND' }),
      ),
      query: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    }));
    await expect(
      service.fetchCoreMetrics('pass', externalAccountId, dateRange),
    ).rejects.toThrow();
  });
});
