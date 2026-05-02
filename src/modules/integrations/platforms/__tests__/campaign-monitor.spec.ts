import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { CampaignMonitorApiService } from '../campaign-monitor-api.service';
import fixture from '../__fixtures__/campaign-monitor.fixture.json';

// Campaign Monitor fixture is an array of campaign objects (the API returns a raw array)
// The fixture has a wrapper with Results array - service reads the raw array directly
// We wrap it to match the service expectation
const campaignArray = (fixture as any).Results ?? fixture;

describe('CampaignMonitorApiService', () => {
  let service: CampaignMonitorApiService;

  beforeEach(() => {
    service = new CampaignMonitorApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Service returns raw array from CM API (not wrapped)
    mockFetchResponse(campaignArray);
    const rows = await service.fetchCoreMetrics('test-token', 'test-client-id', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sends');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when campaigns array is empty', async () => {
    mockFetchResponse([]);
    const rows = await service.fetchCoreMetrics('test-token', 'test-client-id', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are zero/null', async () => {
    mockFetchResponse([
      {
        CampaignID: 'abc',
        SentDate: '2024-01-15 10:00:00',
        TotalRecipients: 0,
        UniqueOpens: 0,
        UniqueClicks: 0,
        Unsubscribed: 0,
        Bounced: 0,
        SpamComplaints: 0,
      },
    ]);
    await expect(
      service.fetchCoreMetrics('test-token', 'test-client-id', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'test-client-id', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
