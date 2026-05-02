import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { AvanserApiService } from '../avanser-api.service';
import fixture from '../__fixtures__/avanser.fixture.json';

// Avanser makes 3 calls: getTokenKey, signIn, getCDR
// getTokenKey returns { tokenKey: 'xxx' }
// signIn returns { token: 'session-token' }
// getCDR returns { data: [...calls] }

const tokenKeyResponse = { tokenKey: 'test-token-key-abc' };
const signInResponse = { token: 'session-token-xyz' };

// Service reads body.data with: date, duration, answered ('1'/'0')
const serviceFixture = {
  data: [
    {
      date: '2024-01-15',
      duration: 203,
      answered: '1',
    },
    {
      date: '2024-01-15',
      duration: 0,
      answered: '0',
    },
    {
      date: '2024-01-16',
      duration: 419,
      answered: 1,
    },
  ],
};

const accountJson = JSON.stringify({ accountId: 'av-5001', secret: 'my-secret' });

describe('AvanserApiService', () => {
  let service: AvanserApiService;

  beforeEach(() => {
    service = new AvanserApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: tokenKeyResponse, status: 200 },
      { body: signInResponse, status: 200 },
      { body: serviceFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', accountJson, { from: '2024-01-15', to: '2024-01-21' });
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

  it('empty data — returns [] when data array is empty', async () => {
    mockFetchSequence([
      { body: tokenKeyResponse, status: 200 },
      { body: signInResponse, status: 200 },
      { body: { data: [] }, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-api-key', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when call fields are null/undefined', async () => {
    mockFetchSequence([
      { body: tokenKeyResponse, status: 200 },
      { body: signInResponse, status: 200 },
      {
        body: {
          data: [
            {
              date: null,
              duration: null,
              answered: null,
            },
          ],
        },
        status: 200,
      },
    ]);
    await expect(
      service.fetchCoreMetrics('test-api-key', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws on failed getTokenKey', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing account config — throws when accountJson is missing fields', async () => {
    await expect(
      service.fetchCoreMetrics('test-api-key', JSON.stringify({}), { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
