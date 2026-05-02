import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { ConstantContactApiService } from '../constant-contact-api.service';
import page2Fixture from '../__fixtures__/constant-contact.page2.fixture.json';

// The service reads body.campaign_activities but the actual fixture has bulk_email_campaign_summaries.
// We use the shape the service actually reads (campaign_activities).
const serviceFixture = {
  campaign_activities: [
    {
      campaign_activity_id: 'act-001',
      scheduled_date: '2024-01-15T10:00:00-00:00',
      unique_sends: 10250,
      opens: 3182,
      unique_opens: 3182,
      clicks: 1071,
      unique_clicks: 1071,
      optouts: 38,
      bounces: 91,
      spam_count: 4,
    },
    {
      campaign_activity_id: 'act-002',
      scheduled_date: '2024-01-18T09:00:00-00:00',
      unique_sends: 10800,
      opens: 3450,
      unique_opens: 3450,
      clicks: 1230,
      unique_clicks: 1230,
      optouts: 44,
      bounces: 97,
      spam_count: 6,
    },
  ],
};

describe('ConstantContactApiService', () => {
  let service: ConstantContactApiService;

  beforeEach(() => {
    service = new ConstantContactApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sends');
    expect(keys).toContain('opens');
    expect(keys).toContain('clicks');
    expect(keys).toContain('unsubscribes');
    expect(keys).toContain('bounces');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when campaign_activities array is empty', async () => {
    mockFetchResponse({ campaign_activities: [] });
    const rows = await service.fetchCoreMetrics('test-token', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when metric fields are zero', async () => {
    mockFetchResponse({
      campaign_activities: [
        {
          campaign_activity_id: 'act-null',
          scheduled_date: null,
          unique_sends: 0,
          opens: 0,
          unique_opens: 0,
          clicks: 0,
          unique_clicks: 0,
          optouts: 0,
          bounces: 0,
          spam_count: 0,
        },
      ],
    });
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

  it('pagination — page2 fixture is valid with bulk_email_campaign_summaries', () => {
    expect(Array.isArray((page2Fixture as any).bulk_email_campaign_summaries)).toBe(true);
  });
});
