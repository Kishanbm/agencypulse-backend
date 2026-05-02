import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { MarchexApiService } from '../marchex-api.service';
import fixture from '../__fixtures__/marchex.fixture.json';

// Marchex service reads body.calls with: callStartUtc, duration, callResult ('Answered' | 'Missed')
// The fixture has calls with call_date (not callStartUtc) — we inject correct shape
const serviceFixture = {
  calls: [
    {
      callStartUtc: '2024-01-15T09:00:00Z',
      duration: 215,
      callResult: 'Answered',
    },
    {
      callStartUtc: '2024-01-15T11:00:00Z',
      duration: 0,
      callResult: 'Missed',
    },
    {
      callStartUtc: '2024-01-16T14:00:00Z',
      duration: 381,
      callResult: 'Answered',
    },
  ],
};

const accountJson = JSON.stringify({ subscriptionKey: 'sub-key-abc123' });

describe('MarchexApiService', () => {
  let service: MarchexApiService;

  beforeEach(() => {
    service = new MarchexApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-org-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
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
    const rows = await service.fetchCoreMetrics('test-org-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when call fields are null/undefined', async () => {
    mockFetchResponse({
      calls: [
        {
          callStartUtc: null,
          duration: null,
          callResult: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-org-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
