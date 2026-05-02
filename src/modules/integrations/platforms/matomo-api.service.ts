import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * Matomo Analytics API service — web analytics metrics.
 *
 * API: Matomo Reporting API
 * Docs: https://developer.matomo.org/api-reference/reporting-api
 *
 * Auth: API token via token_auth query parameter (self-hosted or Matomo Cloud).
 *   The token_auth is a 32-char MD5 hash from Matomo settings.
 * Base URL: configured per-instance (self-hosted)
 *
 * Storage layout:
 *   accessToken       = Matomo API token (token_auth)
 *   externalAccountId = JSON { "matomoUrl": "https://analytics.example.com", "siteId": "1" }
 *
 * Approach:
 *   GET {matomoUrl}/?module=API&method=VisitsSummary.get
 *     &idSite={siteId}&period=range&date={from},{to}&format=JSON&token_auth={token}
 *   Returns aggregated sessions, pageviews, bounce_rate, avg_time_on_site for the range.
 */
@Injectable()
export class MatomoApiService {
  private readonly logger = new Logger(MatomoApiService.name);

  async fetchCoreMetrics(
    apiToken: string,
    accountJson: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    let matomoUrl: string;
    let siteId: string;
    try {
      const parsed = JSON.parse(accountJson) as { matomoUrl?: string; siteId?: string };
      matomoUrl = (parsed.matomoUrl ?? '').replace(/\/$/, '');
      siteId    = parsed.siteId ?? '1';
    } catch {
      throw new BadRequestException('Matomo: externalAccountId must be JSON {matomoUrl, siteId}.');
    }
    if (!matomoUrl) {
      throw new BadRequestException('Matomo: matomoUrl is required.');
    }

    const params = new URLSearchParams({
      module:     'API',
      method:     'VisitsSummary.get',
      idSite:     siteId,
      period:     'range',
      date:       `${dateRange.from},${dateRange.to}`,
      format:     'JSON',
      token_auth: apiToken,
    });

    const resp = await fetchWithRetry(`${matomoUrl}/?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (resp.status === 401 || resp.status === 403) {
      throw new BadRequestException('Matomo API token is invalid.');
    }
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`Matomo VisitsSummary API failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      nb_visits?:           number;
      nb_uniq_visitors?:    number;
      nb_pageviews?:        number;
      bounce_rate?:         string;
      avg_time_on_site?:    number;
    };

    const recordedAt  = dateRange.to;
    const rows: MetricRowInput[] = [];
    if ((body.nb_visits ?? 0) > 0)        rows.push({ metricKey: 'sessions',         value: String(safeInt(body.nb_visits)),        recordedAt });
    if ((body.nb_uniq_visitors ?? 0) > 0)  rows.push({ metricKey: 'users',             value: String(safeInt(body.nb_uniq_visitors)), recordedAt });
    if ((body.nb_pageviews ?? 0) > 0)      rows.push({ metricKey: 'pageviews',         value: String(safeInt(body.nb_pageviews)),     recordedAt });
    const bounceRate = safeFloat(body.bounce_rate ?? '0');
    if (bounceRate > 0)                    rows.push({ metricKey: 'bounce_rate',       value: bounceRate.toFixed(2),         recordedAt });
    if ((body.avg_time_on_site ?? 0) > 0)  rows.push({ metricKey: 'avg_session_sec',  value: String(Math.round(safeFloat(body.avg_time_on_site ?? 0))), recordedAt });
    return rows;
  }
}
