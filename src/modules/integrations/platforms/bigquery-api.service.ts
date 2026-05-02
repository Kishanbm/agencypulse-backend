import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Google BigQuery API service — custom SQL query results as metrics.
 *
 * API: BigQuery Jobs API v2
 * Docs: https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/insert
 *
 * Auth: OAuth 2.0 Bearer token via StandardTokenService (GOOGLE_BIGQUERY in OAUTH_PLATFORM_CONFIGS).
 *   Requires bigquery.jobs.create and bigquery.jobs.get permissions.
 * Base URL: https://bigquery.googleapis.com/bigquery/v2
 *
 * Storage layout:
 *   accessToken       = OAuth Bearer token
 *   externalAccountId = JSON {
 *     "projectId": "my-gcp-project",
 *     "query": "SELECT date, metric_key, value FROM `dataset.metrics_table` WHERE date BETWEEN '{from}' AND '{to}'"
 *   }
 *   The query must return columns: date (YYYY-MM-DD), metric_key (string), value (numeric).
 *   {from} and {to} placeholders are replaced with dateRange values.
 *
 * Approach:
 *   POST /projects/{projectId}/jobs → async job insert (INSERT job config)
 *   Poll GET /projects/{projectId}/jobs/{jobId} until status.state = 'DONE'
 *   GET /projects/{projectId}/queries/{jobId}?pageToken={...} to fetch result rows
 */
@Injectable()
export class BigqueryApiService {
  private readonly logger = new Logger(BigqueryApiService.name);
  private readonly BASE = 'https://bigquery.googleapis.com/bigquery/v2';

  async fetchCoreMetrics(
    accessToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let projectId: string;
    let queryTemplate: string;
    try {
      const parsed   = JSON.parse(accountJson) as { projectId?: string; query?: string };
      projectId      = parsed.projectId ?? '';
      queryTemplate  = parsed.query     ?? '';
    } catch {
      throw new BadRequestException('BigQuery: externalAccountId must be JSON {projectId, query}.');
    }
    if (!projectId || !queryTemplate) {
      throw new BadRequestException('BigQuery: projectId and query are required.');
    }

    const query   = queryTemplate.replace('{from}', dateRange.from).replace('{to}', dateRange.to);
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // Insert async query job
    const jobResp = await fetchWithRetry(`${this.BASE}/projects/${projectId}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        configuration: {
          query: { query, useLegacySql: false, defaultDataset: undefined },
        },
      }),
    });

    if (jobResp.status === 401 || jobResp.status === 403) {
      throw new BadRequestException('BigQuery OAuth token is invalid or lacks bigquery.jobs.create permission.');
    }
    if (!jobResp.ok) {
      const txt = await jobResp.text().catch(() => '');
      throw new BadRequestException(`BigQuery job insert failed (HTTP ${jobResp.status}): ${txt.slice(0, 200)}`);
    }
    const jobBody = await jobResp.json() as { jobReference?: { jobId?: string }; status?: { state?: string } };
    const jobId   = jobBody.jobReference?.jobId ?? '';
    if (!jobId) throw new BadRequestException('BigQuery: no jobId returned from job insert.');

    // Poll until DONE (max 30 polls × 2s = 60s timeout)
    let state = jobBody.status?.state ?? 'RUNNING';
    for (let i = 0; i < 30 && state !== 'DONE'; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetchWithRetry(
        `${this.BASE}/projects/${projectId}/jobs/${jobId}?fields=status`,
        { headers },
      );
      if (pollResp.ok) {
        const pollBody = await pollResp.json() as { status?: { state?: string; errorResult?: { message?: string } } };
        state = pollBody.status?.state ?? 'RUNNING';
        if (pollBody.status?.errorResult?.message) {
          throw new BadRequestException(`BigQuery job error: ${pollBody.status.errorResult.message}`);
        }
      }
    }
    if (state !== 'DONE') throw new BadRequestException('BigQuery job timed out after 60 seconds.');

    // Fetch results
    const resultsResp = await fetchWithRetry(
      `${this.BASE}/projects/${projectId}/queries/${jobId}?maxResults=1000`,
      { headers },
    );
    if (!resultsResp.ok) {
      const txt = await resultsResp.text().catch(() => '');
      throw new BadRequestException(`BigQuery results fetch failed (HTTP ${resultsResp.status}): ${txt.slice(0, 200)}`);
    }

    const resultBody = await resultsResp.json() as {
      schema?: { fields?: Array<{ name?: string }> };
      rows?: Array<{ f?: Array<{ v?: string }> }>;
    };

    const fields = (resultBody.schema?.fields ?? []).map(f => f.name ?? '');
    const dateIdx      = fields.indexOf('date');
    const metricKeyIdx = fields.indexOf('metric_key');
    const valueIdx     = fields.indexOf('value');

    if (dateIdx < 0 || metricKeyIdx < 0 || valueIdx < 0) {
      throw new BadRequestException('BigQuery: query must return columns named "date", "metric_key", and "value".');
    }

    const rows: MetricRowInput[] = [];
    for (const row of resultBody.rows ?? []) {
      const cells    = row.f ?? [];
      const date     = cells[dateIdx]?.v      ?? '';
      const metricKey = cells[metricKeyIdx]?.v ?? '';
      const valueStr  = cells[valueIdx]?.v     ?? '0';
      if (!date || !metricKey) continue;
      rows.push({ metricKey, value: valueStr, recordedAt: date.slice(0, 10) });
    }
    return rows;
  }
}
