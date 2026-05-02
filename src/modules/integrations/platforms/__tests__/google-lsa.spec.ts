import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GoogleLsaApiService } from '../google-lsa-api.service';
import fixture from '../__fixtures__/google-lsa.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('GoogleLsaApiService', () => {
  let service: GoogleLsaApiService;

  beforeEach(() => {
    service = new GoogleLsaApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Supply full aggregatedInfo including phoneLeads and totalCost for complete metric coverage
    const body = {
      accountReports: [
        {
          aggregatedInfo: {
            numImpressions: 3240,
            numLeads: 18,
            phoneLeads: 14,
            messageLeads: 4,
            totalCost: '54200',
          },
        },
      ],
    };
    mockFetchResponse(body);
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('leads');
    expect(keys).toContain('phone_leads');
    expect(keys).toContain('impressions');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ accountReports: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'test-account', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      accountReports: [{ aggregatedInfo: { numImpressions: null, numLeads: null, totalCost: null } }],
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'test-account', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'test-account', dateRange),
    ).rejects.toThrow();
  });
});
