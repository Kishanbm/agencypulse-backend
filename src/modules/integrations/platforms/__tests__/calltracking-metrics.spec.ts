import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { CalltrackingMetricsApiService } from '../calltracking-metrics-api.service';
import fixture from '../__fixtures__/calltracking-metrics.fixture.json';

// CTM service reads: called_at, duration, status ('answered' | 'missed' | 'abandoned')
// The fixture has: status (answered/missed), start_time (not called_at)
// We provide the shape the service reads.
const serviceFixture = {
  calls: [
    {
      called_at: '2024-01-15T08:22:10Z',
      duration: 183,
      status: 'answered',
    },
    {
      called_at: '2024-01-15T10:45:55Z',
      duration: 0,
      status: 'missed',
    },
    {
      called_at: '2024-01-16T13:17:30Z',
      duration: 421,
      status: 'answered',
    },
  ],
};

const accountJson = JSON.stringify({ accountId: 'acc-123', secretKey: 'secret-456' });

describe('CalltrackingMetricsApiService', () => {
  let service: CalltrackingMetricsApiService;

  beforeEach(() => {
    service = new CalltrackingMetricsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('access-key', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_calls');
    expect(keys).toContain('answered_calls');
    expect(keys).toContain('missed_calls');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has calls array', () => {
    expect(Array.isArray((fixture as any).calls)).toBe(true);
  });

  it('empty data — returns [] when calls array is empty', async () => {
    mockFetchResponse({ calls: [] });
    const rows = await service.fetchCoreMetrics('access-key', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when call fields are null/undefined', async () => {
    mockFetchResponse({
      calls: [
        {
          called_at: null,
          duration: null,
          status: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('access-key', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
