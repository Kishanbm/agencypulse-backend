import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { BrevoApiService } from '../brevo-api.service';
import fixture from '../__fixtures__/brevo.fixture.json';

describe('BrevoApiService', () => {
  let service: BrevoApiService;

  beforeEach(() => {
    service = new BrevoApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('delivered');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when campaigns array is empty', async () => {
    mockFetchResponse({ campaigns: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when globalStats fields are null/undefined', async () => {
    mockFetchResponse({
      campaigns: [
        {
          sentDate: '2024-01-15T10:00:00+00:00',
          statistics: {
            globalStats: {
              delivered: null,
              opens: null,
              uniqueOpens: null,
              clickers: null,
              uniqueClicks: null,
              softBounces: null,
              hardBounces: null,
              unsubscriptions: null,
              spamReports: null,
            },
          },
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
