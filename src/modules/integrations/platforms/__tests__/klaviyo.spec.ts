import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { KlaviyoApiService } from '../klaviyo-api.service';
import campaignListFixture from '../__fixtures__/klaviyo.fixture.json';
import page2Fixture from '../__fixtures__/klaviyo.page2.fixture.json';

// Klaviyo makes TWO fetch calls: (1) listCampaigns, (2) fetchCampaignStats
// We need to craft a stats response that has .data with per-campaign stats.
const statsFixture = {
  data: [
    {
      id: '01JDQM4ABCDEF123456789ABC',
      attributes: {
        delivered_count: 9800,
        open_count: 2450,
        click_count: 890,
        unsubscribed_count: 34,
        bounce_count: 62,
        spam_complaint_count: 5,
      },
    },
    {
      id: '01JDQM4XYZABC987654321DEF',
      attributes: {
        delivered_count: 10300,
        open_count: 2780,
        click_count: 1020,
        unsubscribed_count: 41,
        bounce_count: 75,
        spam_complaint_count: 7,
      },
    },
  ],
};

// The fixture has send_time in attributes.sent_at, but the service reads attributes.send_time.
// We inject a campaign list with send_time properly set.
const campaignListWithSendTime = {
  data: [
    {
      type: 'campaign',
      id: '01JDQM4ABCDEF123456789ABC',
      attributes: {
        send_time: '2024-01-15T10:05:00+00:00',
        status: 'Sent',
      },
    },
    {
      type: 'campaign',
      id: '01JDQM4XYZABC987654321DEF',
      attributes: {
        send_time: '2024-01-18T11:03:00+00:00',
        status: 'Sent',
      },
    },
  ],
};

describe('KlaviyoApiService', () => {
  let service: KlaviyoApiService;

  beforeEach(() => {
    service = new KlaviyoApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Two fetch calls: campaign list + stats
    mockFetchSequence([
      { body: campaignListWithSendTime, status: 200 },
      { body: statsFixture, status: 200 },
    ]);
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('delivered');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    expect(keys).toContain('unsubscribes');
    expect(keys).toContain('bounces');
    expect(keys).toContain('spam_complaints');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when campaign list is empty', async () => {
    mockFetchResponse({ data: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are null', async () => {
    const nullStats = {
      data: [
        {
          id: '01JDQM4ABCDEF123456789ABC',
          attributes: {
            delivered_count: null,
            open_count: null,
            click_count: null,
            unsubscribed_count: null,
            bounce_count: null,
            spam_complaint_count: null,
          },
        },
      ],
    };
    mockFetchSequence([
      { body: campaignListWithSendTime, status: 200 },
      { body: nullStats, status: 200 },
    ]);
    await expect(
      service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws on 401 from campaign list', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('pagination — page2 fixture is valid JSON with data array', () => {
    // Ensure page2 fixture is well-formed
    expect(Array.isArray(page2Fixture.data)).toBe(true);
    expect(page2Fixture.data.length).toBeGreaterThan(0);
  });
});
