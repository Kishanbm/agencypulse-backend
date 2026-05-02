import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { GoogleSheetsApiService } from '../google-sheets-api.service';
import fixture from '../__fixtures__/google-sheets.fixture.json';

const accountJson = JSON.stringify({
  spreadsheetId: '1abc',
  range: 'Sheet1!A:C',
  dateColumn: 0,
  metricKeyColumn: 1,
  valueColumn: 2,
});
const dateRange = { from: '2024-03-01', to: '2024-03-03' };

describe('GoogleSheetsApiService', () => {
  let service: GoogleSheetsApiService;

  beforeEach(() => {
    service = new GoogleSheetsApiService();
    clearFetchMocks();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    mockFetchResponse(fixture);
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sessions');
    expect(keys).toContain('conversions');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when only header row exists', async () => {
    mockFetchResponse({ values: [['date', 'metric_key', 'value']] });
    const rows = await service.fetchCoreMetrics('test-token', accountJson, dateRange);
    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when rows have missing values', async () => {
    mockFetchResponse({
      values: [
        ['date', 'metric_key', 'value'],
        ['2024-03-01', null, '100'],
        ['2024-03-01', 'sessions', null],
      ],
    });
    await expect(
      service.fetchCoreMetrics('test-token', accountJson, dateRange),
    ).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, dateRange),
    ).rejects.toThrow();
  });
});
