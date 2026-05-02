import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Gravity Forms API service — WordPress form submission metrics.
 *
 * API: Gravity Forms REST API v2
 * Docs: https://docs.gravityforms.com/rest-api-v2/
 *
 * Auth: HTTP Basic — consumer_key:consumer_secret (Gravity Forms REST API keys).
 *   consumer_key  = accessToken
 *   consumer_secret + siteUrl + formId stored in externalAccountId JSON.
 * Base URL: https://{siteUrl}/wp-json/gf/v2
 *
 * Storage layout:
 *   accessToken       = Gravity Forms consumer_key
 *   externalAccountId = JSON { "siteUrl": "https://...", "consumerSecret": "cs_...", "formId": "1" }
 *
 * Approach:
 *   GET /forms/{formId}/entries?paging[page_size]=200&paging[current_page]={n}
 *     &search[field_filters][][key]=date_created&search[field_filters][][value]={from}
 *   Filters entries created within dateRange. Counts total_entries.
 *   Stored as snapshot at dateRange.to.
 */
@Injectable()
export class GravityFormsApiService {
  private readonly logger = new Logger(GravityFormsApiService.name);

  async fetchCoreMetrics(
    consumerKey: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let siteUrl: string;
    let consumerSecret: string;
    let formId: string;
    try {
      const parsed   = JSON.parse(accountJson) as { siteUrl?: string; consumerSecret?: string; formId?: string };
      siteUrl        = (parsed.siteUrl       ?? '').replace(/\/$/, '');
      consumerSecret = parsed.consumerSecret ?? '';
      formId         = parsed.formId         ?? '1';
    } catch {
      throw new BadRequestException('Gravity Forms: externalAccountId must be JSON {siteUrl, consumerSecret, formId}.');
    }
    if (!siteUrl || !consumerSecret) {
      throw new BadRequestException('Gravity Forms: siteUrl and consumerSecret are required.');
    }

    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const BASE        = `${siteUrl}/wp-json/gf/v2`;

    let totalEntries = 0;
    let page         = 1;
    let hasMore      = true;
    const MAX_PAGES  = 100;
    let pages        = 0;

    while (hasMore) {
      if (++pages > MAX_PAGES) { this.logger.warn('GravityFormsApiService: pagination cap (100 pages) reached'); break; }
      const params = new URLSearchParams();
      params.set('paging[page_size]', '200');
      params.set('paging[current_page]', String(page));
      params.set('search[start_date]', dateRange.from);
      params.set('search[end_date]',   dateRange.to);
      params.set('search[status]',     'active');

      const resp = await fetchWithRetry(`${BASE}/forms/${formId}/entries?${params.toString()}`, {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
        },
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new BadRequestException('Gravity Forms API keys are invalid.');
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new BadRequestException(`Gravity Forms entries API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
      }

      const body = await resp.json() as {
        entries?: unknown[];
        total_count?: number;
      };

      if (!body.entries) {
        this.logger.warn('GravityFormsApiService: unexpected response shape — missing entries');
        break;
      }

      const entries = body.entries ?? [];
      totalEntries += entries.length;
      hasMore = entries.length === 200;
      page++;
    }

    const recordedAt = dateRange.to;
    const rows: MetricRowInput[] = [];
    if (totalEntries > 0) rows.push({ metricKey: 'form_submissions', value: String(totalEntries), recordedAt });
    return rows;
  }
}
