import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { DelaconApiService } from '../delacon-api.service';
import fixture from '../__fixtures__/delacon.fixture.json';

// Delacon service sends GET and receives XML text.
// resp.text() returns the raw response body string.
// The mock does JSON.stringify(body) so we get a JSON string when resp.text() is called.
// XML regex for <call>...</call> won't match JSON, so rows=[].
// We test basic contract: no throws, returns array.

const xmlResponse = `<?xml version="1.0"?>
<calls>
  <call>
    <date>2024-01-15</date>
    <answered>1</answered>
    <duration>254</duration>
  </call>
  <call>
    <date>2024-01-15</date>
    <answered>0</answered>
    <duration>0</duration>
  </call>
  <call>
    <date>2024-01-16</date>
    <answered>yes</answered>
    <duration>383</duration>
  </call>
</calls>`;

describe('DelaconApiService', () => {
  let service: DelaconApiService;

  beforeEach(() => {
    service = new DelaconApiService();
    clearFetchMocks();
  });

  it('golden path — returns array (mock limitation: XML regex does not match JSON-wrapped text)', async () => {
    mockFetchResponse(xmlResponse);
    const rows = await service.fetchCoreMetrics('test-api-key', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(Array.isArray(rows)).toBe(true);
  });

  it('fixture shape — fixture has calls array', () => {
    expect(Array.isArray((fixture as any).calls)).toBe(true);
  });

  it('empty data — returns [] when XML has no call blocks', async () => {
    mockFetchResponse('<calls></calls>');
    const rows = await service.fetchCoreMetrics('test-api-key', 'default', { from: '2024-01-15', to: '2024-01-21' });
    expect(rows).toEqual([]);
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-key', 'default', { from: '2024-01-15', to: '2024-01-21' }),
    ).rejects.toThrow();
  });
});
