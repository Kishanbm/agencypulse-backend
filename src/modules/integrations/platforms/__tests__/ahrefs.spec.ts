import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { AhrefsApiService } from '../ahrefs-api.service';
import fixture from '../__fixtures__/ahrefs.fixture.json';

describe('AhrefsApiService', () => {
  let service: AhrefsApiService;

  beforeEach(() => {
    service = new AhrefsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'example.com', { from: '2024-03-01', to: '2024-03-07' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('org_traffic');
    expect(keys).toContain('org_keywords');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when metrics array is empty', async () => {
    mockFetchResponse({ metrics: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      metrics: [
        {
          date: '2024-01-15',
          org_traffic: null,
          org_keywords: null,
          paid_traffic: null,
          paid_keywords: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing domain — throws when domain is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
