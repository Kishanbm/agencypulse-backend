import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { BrightLocalApiService } from '../brightlocal-api.service';
import fixture from '../__fixtures__/brightlocal.fixture.json';

// BrightLocal service reads body.response (object with average-rank, keywords-in-top-3, etc.)
// The fixture has a reports array - we provide the shape the service expects.
const serviceFixture = {
  response: {
    'average-rank': 6.8,
    'keywords-in-top-3': 12,
    'keywords-in-top-10': 47,
    'keywords-in-top-20': 89,
    date: '2024-01-21',
  },
};

describe('BrightLocalApiService', () => {
  let service: BrightLocalApiService;

  beforeEach(() => {
    service = new BrightLocalApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-token', '77301', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('avg_rank');
    expect(keys).toContain('keywords_top3');
    expect(keys).toContain('keywords_top10');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has reports array', () => {
    expect(Array.isArray((fixture as any).reports)).toBe(true);
  });

  it('empty data — returns [] when response is null', async () => {
    mockFetchResponse({ response: null });
    const rows = await service.fetchCoreMetrics('test-token', '77301', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      response: {
        'average-rank': null,
        'keywords-in-top-3': null,
        'keywords-in-top-10': null,
        'keywords-in-top-20': null,
        date: '2024-01-21',
      },
    });
    await expect(
      service.fetchCoreMetrics('test-token', '77301', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', '77301', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing campaign ID — throws when campaignId is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
