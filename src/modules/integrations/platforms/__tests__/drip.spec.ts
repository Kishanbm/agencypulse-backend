import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { DripApiService } from '../drip-api.service';
import fixture from '../__fixtures__/drip.fixture.json';

describe('DripApiService', () => {
  let service: DripApiService;

  beforeEach(() => {
    service = new DripApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', '12345', { from: '2024-01-15', to: '2024-05-01' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sends');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when broadcasts array is empty', async () => {
    mockFetchResponse({ broadcasts: [] });
    const rows = await service.fetchCoreMetrics('test-token', '12345', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      broadcasts: [
        {
          id: '55000000',
          status: 'sent',
          send_at: '2024-01-15T10:00:00Z',
          subscriber_count: null,
          unique_open_count: null,
          unique_click_count: null,
          unsubscribe_count: null,
          hard_bounce_count: null,
          soft_bounce_count: null,
          spam_complaint_count: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', '12345', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', '12345', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing account ID — throws when accountId is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
