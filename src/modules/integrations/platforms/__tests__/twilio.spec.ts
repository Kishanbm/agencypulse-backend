import './helpers/mock-fetch';
import { mockFetchResponse, mockFetchSequence, clearFetchMocks } from './helpers/mock-fetch';
import { TwilioApiService } from '../twilio-api.service';
import fixture from '../__fixtures__/twilio.fixture.json';

// Twilio service reads body.calls with: start_time, duration (string), status, direction
// The fixture matches these fields well.
// Service groups by completed status only for total/inbound/outbound counts.

const page2Fixture = {
  calls: [
    {
      sid: 'CA4567890123defghi4567890123defghi',
      direction: 'inbound',
      status: 'completed',
      start_time: 'Sun, 03 Mar 2024 09:00:00 +0000',
      duration: '145',
    },
  ],
  next_page_uri: null,
};

describe('TwilioApiService', () => {
  let service: TwilioApiService;

  beforeEach(() => {
    service = new TwilioApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-auth-token', 'ACxxxxxxxxxxxx', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_calls');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when calls array is empty', async () => {
    mockFetchResponse({ calls: [], next_page_uri: null });
    const rows = await service.fetchCoreMetrics('test-auth-token', 'ACxxxxxxxxxxxx', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when call fields are null/undefined', async () => {
    mockFetchResponse({
      calls: [
        {
          start_time: 'Mon, 15 Jan 2024 09:00:00 +0000',
          duration: null,
          status: null,
          direction: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-auth-token', 'ACxxxxxxxxxxxx', { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'ACxxxxxxxxxxxx', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });

  it('missing account SID — throws when accountSid is "default"', async () => {
    await expect(
      service.fetchCoreMetrics('test-auth-token', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
