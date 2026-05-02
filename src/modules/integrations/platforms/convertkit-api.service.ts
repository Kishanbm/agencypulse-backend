import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { fetchWithRetry } from '../../../common/http/fetch-with-retry';
import { safeInt, safeFloat, safeStr } from '../../../common/utils/safe-parse';

/**
 * ConvertKit (now Kit) API service — email broadcast performance.
 *
 * API version: v4
 * Docs: https://developers.kit.com/reference
 *
 * Auth: `Authorization: Bearer {api_key}` header.
 * Base URL: https://api.convertkit.com/v4
 *
 * Approach:
 *   1. `GET /broadcasts` — returns list of broadcasts (email sends).
 *   2. For each broadcast in the date range, `GET /broadcasts/{id}/stats` for metrics.
 *
 * Note: ConvertKit v4 does not support date filtering on the broadcasts list endpoint;
 * we fetch all and filter by `created_at` on the client side.
 */
@Injectable()
export class ConvertKitApiService {
  private readonly logger = new Logger(ConvertKitApiService.name);
  private readonly BASE = 'https://api.convertkit.com/v4';

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };
  }

  /**
   * @param apiKey    ConvertKit API key (v4 secret)
   * @param _accountId Not needed for ConvertKit v4. Pass 'default'.
   * @param dateRange  { from, to } in YYYY-MM-DD
   */
  async fetchCoreMetrics(
    apiKey: string,
    _accountId: string,
    dateRange: { from: string; to: string },
  ): Promise<MetricRowInput[]> {
    const broadcasts = await this.listBroadcasts(apiKey, dateRange);
    if (!broadcasts.length) return [];

    const rows: MetricRowInput[] = [];

    // Fetch stats for each broadcast (rate-limit friendly: limit to 20)
    const limit = broadcasts.slice(0, 20);
    for (const b of limit) {
      try {
        const stats = await this.getBroadcastStats(apiKey, b.id);
        const recordedAt = b.created_at.slice(0, 10);

        if (stats.recipients > 0)    rows.push({ metricKey: 'sends',        value: String(safeInt(stats.recipients)),   recordedAt });
        if (stats.open_rate != null) rows.push({ metricKey: 'open_rate',     value: String(safeFloat(stats.open_rate)),    recordedAt });
        if (stats.click_rate != null) rows.push({ metricKey: 'click_rate',   value: String(safeFloat(stats.click_rate)),   recordedAt });
        if (stats.unsubscribes > 0)  rows.push({ metricKey: 'unsubscribes', value: String(safeInt(stats.unsubscribes)), recordedAt });
      } catch (err) {
        this.logger.warn(`ConvertKit: failed to fetch stats for broadcast ${b.id}: ${(err as Error).message}`);
      }
    }

    return rows;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async listBroadcasts(
    apiKey: string,
    dateRange: { from: string; to: string },
  ): Promise<Array<{ id: number; created_at: string }>> {
    const resp = await fetchWithRetry(
      `${this.BASE}/broadcasts?per_page=50`,
      { headers: this.headers(apiKey) },
    );

    if (resp.status === 401) throw new BadRequestException('ConvertKit API key is invalid.');
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new BadRequestException(`ConvertKit broadcasts list failed (HTTP ${resp.status}): ${txt.slice(0, 200)}`);
    }

    const body = await resp.json() as {
      broadcasts: Array<{ id: number; created_at: string; published: boolean }>;
    };

    const fromMs = new Date(`${dateRange.from}T00:00:00Z`).getTime();
    const toMs   = new Date(`${dateRange.to}T23:59:59Z`).getTime();

    return (body.broadcasts ?? []).filter((b) => {
      if (!b.published) return false;
      const ts = new Date(b.created_at).getTime();
      return ts >= fromMs && ts <= toMs;
    });
  }

  private async getBroadcastStats(
    apiKey: string,
    broadcastId: number,
  ): Promise<{
    recipients: number;
    open_rate: number | null;
    click_rate: number | null;
    unsubscribes: number;
  }> {
    const resp = await fetchWithRetry(
      `${this.BASE}/broadcasts/${broadcastId}/stats`,
      { headers: this.headers(apiKey) },
    );

    if (!resp.ok) {
      throw new BadRequestException(`ConvertKit broadcast stats failed (HTTP ${resp.status})`);
    }

    const body = await resp.json() as {
      broadcast: {
        stats: {
          recipients?: number;
          open_rate?: number;
          click_rate?: number;
          unsubscribes?: number;
        };
      };
    };

    const s = body.broadcast?.stats ?? {};
    return {
      recipients:  s.recipients  ?? 0,
      open_rate:   s.open_rate   ?? null,
      click_rate:  s.click_rate  ?? null,
      unsubscribes: s.unsubscribes ?? 0,
    };
  }
}
