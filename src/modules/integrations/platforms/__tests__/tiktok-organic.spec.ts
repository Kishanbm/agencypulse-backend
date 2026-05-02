import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { TiktokOrganicApiService } from '../tiktok-organic-api.service';
import fixture from '../__fixtures__/tiktok-organic.fixture.json';

const dateRange = { from: '2024-03-01', to: '2024-03-02' };

describe('TiktokOrganicApiService', () => {
  let service: TiktokOrganicApiService;

  beforeEach(() => {
    service = new TiktokOrganicApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_views');
    expect(keys).toContain('total_likes');
    expect(keys).toContain('total_comments');
    expect(keys).toContain('total_shares');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: { videos: [] }, cursor: 0, has_more: false });
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      data: {
        videos: [
          { create_time: 1709251200, view_count: null, like_count: null, comment_count: null, share_count: null },
        ],
      },
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'default', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'default', dateRange),
    ).rejects.toThrow();
  });
});
