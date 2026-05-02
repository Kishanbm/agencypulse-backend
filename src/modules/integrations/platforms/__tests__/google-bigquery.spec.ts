import './helpers/mock-fetch';
import { mockFetchResponse, clearFetchMocks } from './helpers/mock-fetch';
import { BigqueryApiService } from '../bigquery-api.service';
import fixture from '../__fixtures__/google-bigquery.fixture.json';

const accountJson = JSON.stringify({
  projectId: 'my-gcp-project',
  query: "SELECT date, metric_key, value FROM `dataset.metrics` WHERE date BETWEEN '{from}' AND '{to}'",
});
const dateRange = { from: '2024-01-15', to: '2024-01-21' };

describe('BigqueryApiService', () => {
  let service: BigqueryApiService;

  beforeEach(() => {
    service = new BigqueryApiService();
    clearFetchMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('golden path — returns correct MetricRowInput[] from valid response', async () => {
    // Step 1: insert job → returns jobId with RUNNING state
    mockFetchResponse({
      jobReference: { jobId: 'bq-job-abc123', projectId: 'my-gcp-project' },
      status: { state: 'RUNNING' },
    });
    // Step 2: poll → DONE
    mockFetchResponse({ status: { state: 'DONE' } });
    // Step 3: fetch results
    mockFetchResponse(fixture);

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows.length).toBeGreaterThan(0);
    const keys = rows.map(r => r.metricKey);
    expect(keys).toContain('sessions');
    expect(keys).toContain('conversions');
    rows.forEach(r => expect(r.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/));
    rows.forEach(r => expect(Number.isNaN(parseFloat(r.value))).toBe(false));
  });

  it('empty data — returns [] when query result has no rows', async () => {
    mockFetchResponse({
      jobReference: { jobId: 'bq-job-empty', projectId: 'my-gcp-project' },
      status: { state: 'DONE' },
    });
    mockFetchResponse({
      schema: { fields: [{ name: 'date' }, { name: 'metric_key' }, { name: 'value' }] },
      rows: [],
    });

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toEqual([]);
  });

  it('null fields — does not throw when row values are null', async () => {
    mockFetchResponse({
      jobReference: { jobId: 'bq-job-null', projectId: 'my-gcp-project' },
      status: { state: 'DONE' },
    });
    mockFetchResponse({
      schema: { fields: [{ name: 'date' }, { name: 'metric_key' }, { name: 'value' }] },
      rows: [{ f: [{ v: null }, { v: null }, { v: null }] }],
    });

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.not.toThrow();
  });

  it('auth error — throws BadRequestException on 401', async () => {
    mockFetchResponse({ error: 'Unauthorized' }, 401);
    await expect(
      service.fetchCoreMetrics('bad-token', accountJson, dateRange),
    ).rejects.toThrow();
  });

  it('polling — handles RUNNING then DONE states correctly', async () => {
    // Job starts RUNNING
    mockFetchResponse({
      jobReference: { jobId: 'bq-job-poll', projectId: 'my-gcp-project' },
      status: { state: 'RUNNING' },
    });
    // First poll: still RUNNING
    mockFetchResponse({ status: { state: 'RUNNING' } });
    // Second poll: DONE
    mockFetchResponse({ status: { state: 'DONE' } });
    // Results
    mockFetchResponse(fixture);

    const promise = service.fetchCoreMetrics('test-token', accountJson, dateRange);
    await jest.runAllTimersAsync();
    const rows = await promise;

    expect(rows.length).toBeGreaterThan(0);
  });
});
