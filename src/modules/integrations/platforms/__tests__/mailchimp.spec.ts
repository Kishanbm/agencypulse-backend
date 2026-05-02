import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { MailchimpApiService } from '../mailchimp-api.service';
import fixture from '../__fixtures__/mailchimp.fixture.json';

describe('MailchimpApiService', () => {
  let service: MailchimpApiService;

  beforeEach(() => {
    service = new MailchimpApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'us1', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sends');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    expect(keys).toContain('unsubscribes');
    expect(keys).toContain('bounces');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when campaigns array is empty', async () => {
    mockFetchResponse({ campaigns: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'us1', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when report_summary is null', async () => {
    mockFetchResponse({
      campaigns: [
        {
          id: 'abc123',
          send_time: '2024-01-15T10:00:00+00:00',
          report_summary: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'us1', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'us1', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing dc — throws when dc is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
