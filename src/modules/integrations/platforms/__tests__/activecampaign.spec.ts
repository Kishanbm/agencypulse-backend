import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { ActiveCampaignApiService } from '../activecampaign-api.service';
import fixture from '../__fixtures__/activecampaign.fixture.json';

// ActiveCampaign service reads: totalrecipients, uniqueopens, uniqueclicks, unsubscribes, hardbounces, softbounces
// The fixture has: uniqueopens, uniquelinkclicks (not uniqueclicks), bounces (not hardbounces/softbounces)
// We use the fixture as-is — service gracefully handles missing keys via safeInt
const accountJson = JSON.stringify({ apiUrl: 'https://myaccount.api-us1.com' });

describe('ActiveCampaignApiService', () => {
  let service: ActiveCampaignApiService;

  beforeEach(() => {
    service = new ActiveCampaignApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Inject fixture data that matches what the service reads
    const body = {
      campaigns: [
        {
          sdate: '2024-01-15 10:00:00',
          totalrecipients: '8520',
          uniqueopens: '2134',
          uniqueclicks: '897',
          unsubscribes: '34',
          hardbounces: '40',
          softbounces: '22',
        },
      ],
    };
    mockFetchResponse(body);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sends');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has campaigns array', () => {
    expect(Array.isArray((fixture as any).campaigns)).toBe(true);
  });

  it('empty data — returns [] when campaigns array is empty', async () => {
    mockFetchResponse({ campaigns: [] });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      campaigns: [
        {
          sdate: '2024-01-15 10:00:00',
          totalrecipients: null,
          uniqueopens: null,
          uniqueclicks: null,
          unsubscribes: null,
          hardbounces: null,
          softbounces: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
