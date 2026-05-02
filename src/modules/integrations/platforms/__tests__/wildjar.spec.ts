import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { WildJarApiService } from '../wildjar-api.service';
import fixture from '../__fixtures__/wildjar.fixture.json';

// WildJar makes 2 calls: (1) POST /token/ to get access_token, (2) GET /calls/
// Service reads body.results with: answered, duration, timestamp
// The fixture has calls array (not results) — we inject the correct shape.

const tokenResponse = { access_token: 'wildjar-bearer-token-xyz' };

const serviceFixture = {
  results: [
    {
      answered: true,
      duration: 176,
      timestamp: '2024-01-15T09:05:18Z',
    },
    {
      answered: false,
      duration: 0,
      timestamp: '2024-01-15T14:22:40Z',
    },
    {
      answered: true,
      duration: 329,
      timestamp: '2024-01-16T11:50:05Z',
    },
  ],
};

const accountJson = JSON.stringify({ password: 'wildjar-pass-123' });

describe('WildJarApiService', () => {
  let service: WildJarApiService;

  beforeEach(() => {
    service = new WildJarApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: tokenResponse, status: 200 },
      { body: serviceFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('wildjar-user', accountJson, { from: '2024-01-15', to: '2024-01-21' });
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

  it('empty data — returns [] when results array is empty', async () => {
    mockFetchSequence([
      { body: tokenResponse, status: 200 },
      { body: { results: [] }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('wildjar-user', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when call fields are null/undefined', async () => {
    mockFetchSequence([
      { body: tokenResponse, status: 200 },
      {
        body: {
          results: [
            {
              answered: null,
              duration: null,
              timestamp: null,
            },
          ],
        },
        status: 200,
      },
    ]);
    await expect(
      service.fetchCoreMetrics('wildjar-user', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws on token exchange failure', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-user', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing password — throws when accountJson has no password', async () => {
    await expect(
      service.fetchCoreMetrics('wildjar-user', JSON.stringify({}), { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
