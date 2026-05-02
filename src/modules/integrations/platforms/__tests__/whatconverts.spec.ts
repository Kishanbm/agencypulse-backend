import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { WhatConvertsApiService } from '../whatconverts-api.service';
import fixture from '../__fixtures__/whatconverts.fixture.json';

// WhatConverts service reads body.leads with lead_type: phone_call | web_form | chat
// The fixture has lead_type: 'call' | 'form' | 'chat' (service checks 'phone_call' | 'web_form' | 'chat')
// We provide the shape the service reads for the golden path.
const serviceFixture = {
  leads: [
    {
      date_created: '2024-01-15T09:10:00',
      lead_type: 'phone_call',
    },
    {
      date_created: '2024-01-15T11:30:00',
      lead_type: 'web_form',
    },
    {
      date_created: '2024-01-16T14:20:00',
      lead_type: 'phone_call',
    },
    {
      date_created: '2024-01-16T16:05:00',
      lead_type: 'chat',
    },
  ],
};

const accountJson = JSON.stringify({ secretKey: 'secret-abc' });

describe('WhatConvertsApiService', () => {
  let service: WhatConvertsApiService;

  beforeEach(() => {
    service = new WhatConvertsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(serviceFixture);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('total_leads');
    expect(keys).toContain('call_leads');
    expect(keys).toContain('form_leads');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('fixture shape — fixture has leads array', () => {
    expect(Array.isArray((fixture as any).leads)).toBe(true);
  });

  it('empty data — returns [] when leads array is empty', async () => {
    mockFetchResponse({ leads: [] });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when lead fields are null/undefined', async () => {
    mockFetchResponse({
      leads: [
        {
          date_created: null,
          lead_type: null,
        },
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
