import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { VimeoApiService } from '../vimeo-api.service';
import fixture from '../__fixtures__/vimeo.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('VimeoApiService', () => {
  let service: VimeoApiService;

  beforeEach(() => {
    service = new VimeoApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_plays');
    expect(keys).toContain('total_likes');
    expect(keys).toContain('total_comments');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when API returns empty results', async () => {
    mockFetchResponse({ data: [], paging: { next: null } });
    const rows = await service.fetchCoreMetrics('test-token', 'default', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      data: [{ stats: { plays: null, likes: null, comments: null } }],
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
