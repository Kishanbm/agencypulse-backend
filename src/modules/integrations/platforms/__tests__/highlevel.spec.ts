import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { HighlevelApiService } from '../highlevel-api.service';
import fixture from '../__fixtures__/highlevel.fixture.json';

const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('HighlevelApiService', () => {
  let service: HighlevelApiService;

  beforeEach(() => {
    service = new HighlevelApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Call 1: contacts
    mockFetchResponse(fixture.contacts);
    // Call 2: opportunities
    mockFetchResponse(fixture.opportunities);

    const rows = await service.fetchCoreMetrics('test-token', 'location-abc123', dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('new_contacts');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when both contacts and opportunities are empty', async () => {
    mockFetchResponse({ contacts: [], meta: {} });
    mockFetchResponse({ opportunities: [], meta: {} });
    const rows = await service.fetchCoreMetrics('test-token', 'location-abc123', dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when monetaryValue is null', async () => {
    mockFetchResponse({ contacts: [{ id: 'c1' }], meta: { startAfterId: null } });
    mockFetchResponse({ opportunities: [{ id: 'o1', monetaryValue: null }] });
    await expect(
      service.fetchCoreMetrics('test-token', 'location-abc123', dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', 'location-abc123', dateRange),
    ).rejects.toThrow();
  });

  it('pagination — fetches all contact pages via cursor', async () => {
    // Page 1: 100 contacts with next cursor
    const page1Contacts = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` }));
    // Page 2: fewer than 100, stops pagination
    const page2Contacts = [{ id: 'c100' }, { id: 'c101' }];
    mockFetchResponse({ contacts: page1Contacts, meta: { startAfterId: 'cursor-page2' } });
    mockFetchResponse({ contacts: page2Contacts, meta: { startAfterId: null } });
    // Opportunities call
    mockFetchResponse({ opportunities: [], meta: {} });

    const rows = await service.fetchCoreMetrics('test-token', 'location-abc123', dateRange);
    const contactsRow = rows.find(r => r.metricKey === 'new_contacts');
    expect(contactsRow).toBeDefined();
    expect(parseInt(contactsRow!.value)).toBe(102);
  });
});
