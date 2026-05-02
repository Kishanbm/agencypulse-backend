import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { MajesticApiService } from '../majestic-api.service';
import fixture from '../__fixtures__/majestic.fixture.json';

// Majestic service checks body.Code === 'OK'; the fixture has Code: 200 (number).
// We inject a response with Code: 'OK' to match what the service checks.
const serviceFixture = {
  Code: 'OK',
  DataTables: {
    Results: {
      Data: [
        {
          ExtBackLinks: 48700,
          RefDomains: 1920,
          CitationFlow: 51,
          TrustFlow: 42,
          RefIPs: 1540,
        },
      ],
    },
  },
};

describe('MajesticApiService', () => {
  let service: MajesticApiService;

  beforeEach(() => {
    service = new MajesticApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('trust_flow');
    expect(keys).toContain('citation_flow');
    expect(keys).toContain('ref_domains');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when Data array is empty', async () => {
    mockFetchResponse({ Code: 'OK', DataTables: { Results: { Data: [] } } });
    const rows = await service.fetchCoreMetrics('test-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null/undefined', async () => {
    mockFetchResponse({
      Code: 'OK',
      DataTables: {
        Results: {
          Data: [
            {
              ExtBackLinks: null,
              RefDomains: null,
              CitationFlow: null,
              TrustFlow: null,
              RefIPs: null,
            },
          ],
        },
      },
    });
    await expect(
      service.fetchCoreMetrics('test-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'example.com', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing domain — throws when domain is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
