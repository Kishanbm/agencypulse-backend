import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { ConvertKitApiService } from '../convertkit-api.service';
import fixture from '../__fixtures__/convertkit.fixture.json';

// ConvertKit makes TWO calls per broadcast: (1) listBroadcasts, (2) per-broadcast stats
// The fixture contains the broadcasts list. The service filters by published=true and date range.
// We need broadcasts with published: true and created_at in range, then a stats response per broadcast.

const broadcastsInRange = {
  broadcasts: [
    {
      id: 7891,
      created_at: '2024-01-15T08:00:00.000Z',
      subject: 'Test broadcast',
      published: true,
    },
  ],
};

const statsResponse = {
  broadcast: {
    stats: {
      recipients: 5000,
      open_rate: 0.32,
      click_rate: 0.12,
      unsubscribes: 15,
    },
  },
};

describe('ConvertKitApiService', () => {
  let service: ConvertKitApiService;

  beforeEach(() => {
    service = new ConvertKitApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchSequence([
      { body: broadcastsInRange, status: 200 },
      { body: statsResponse, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sends');
    expect(keys).toContain('unsubscribes');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has broadcasts array', () => {
    expect(Array.isArray((fixture as any).broadcasts)).toBe(true);
  });

  it('empty data — returns [] when broadcasts array is empty', async () => {
    mockFetchResponse({ broadcasts: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when stats fields are null/undefined', async () => {
    mockFetchSequence([
      { body: broadcastsInRange, status: 200 },
      {
        body: {
          broadcast: {
            stats: {
              recipients: 0,
              open_rate: null,
              click_rate: null,
              unsubscribes: 0,
            },
          },
        },
        status: 200,
      },
    ]);
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
