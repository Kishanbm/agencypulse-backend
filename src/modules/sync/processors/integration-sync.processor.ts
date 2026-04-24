import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { IntegrationPlatform, ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { Ga4OAuthService } from '../../integrations/ga4/ga4-oauth.service';
import { Ga4ApiService } from '../../integrations/ga4/ga4-api.service';
import { GoogleAdsOAuthService } from '../../integrations/google-ads/google-ads-oauth.service';
import { GoogleAdsApiService } from '../../integrations/google-ads/google-ads-api.service';
import { MetaAdsOAuthService } from '../../integrations/meta-ads/meta-ads-oauth.service';
import { MetaAdsApiService } from '../../integrations/meta-ads/meta-ads-api.service';
import { GscOAuthService } from '../../integrations/google-search-console/gsc-oauth.service';
import { GscApiService } from '../../integrations/google-search-console/gsc-api.service';
import { YoutubeOAuthService } from '../../integrations/youtube/youtube-oauth.service';
import { YoutubeApiService } from '../../integrations/youtube/youtube-api.service';
import { LinkedinAdsOAuthService } from '../../integrations/linkedin-ads/linkedin-ads-oauth.service';
import { LinkedinAdsApiService } from '../../integrations/linkedin-ads/linkedin-ads-api.service';
import { TiktokAdsOAuthService } from '../../integrations/tiktok-ads/tiktok-ads-oauth.service';
import { TiktokAdsApiService } from '../../integrations/tiktok-ads/tiktok-ads-api.service';
import { AmazonAdsOAuthService } from '../../integrations/amazon-ads/amazon-ads-oauth.service';
import { AmazonAdsApiService } from '../../integrations/amazon-ads/amazon-ads-api.service';
import { MetricsService } from '../../metrics/metrics.service';
import { MetricRowInput } from '../../metrics/dto/query-metrics.dto';
import { SYNC_QUEUE } from '../constants/sync-queue.constants';
import { SyncJobPayload } from '../dto/sync-job.dto';
import { ALERT_CHECK_QUEUE } from '../../alerts/constants/alert-queue.constants';
import { AlertCheckJobPayload } from '../../alerts/processors/alert-check.processor';
import { NotificationsService } from '../../notifications/notifications.service';

@Processor(SYNC_QUEUE, {
  concurrency: 5, // Fix 2: max 5 jobs running simultaneously per worker process

  settings: {
    // Optional but high-value: jitter prevents thundering herd when many jobs
    // retry at the same time (e.g. after a brief platform outage).
    // delay = base * 2^attempt + random(0–1000ms)
    backoffStrategy: (attemptsMade: number): number => {
      return Math.pow(2, attemptsMade) * 5_000 + Math.floor(Math.random() * 1_000);
    },
  },
})
export class IntegrationSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationSyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly ga4OAuth: Ga4OAuthService,
    private readonly ga4Api: Ga4ApiService,
    private readonly googleAdsOAuth: GoogleAdsOAuthService,
    private readonly googleAdsApi: GoogleAdsApiService,
    private readonly metaAdsOAuth: MetaAdsOAuthService,
    private readonly metaAdsApi: MetaAdsApiService,
    private readonly gscOAuth: GscOAuthService,
    private readonly gscApi: GscApiService,
    private readonly youtubeOAuth: YoutubeOAuthService,
    private readonly youtubeApi: YoutubeApiService,
    private readonly linkedinAdsOAuth: LinkedinAdsOAuthService,
    private readonly linkedinAdsApi: LinkedinAdsApiService,
    private readonly tiktokAdsOAuth: TiktokAdsOAuthService,
    private readonly tiktokAdsApi: TiktokAdsApiService,
    private readonly amazonAdsOAuth: AmazonAdsOAuthService,
    private readonly amazonAdsApi: AmazonAdsApiService,
    private readonly metricsService: MetricsService,
    @InjectQueue(ALERT_CHECK_QUEUE)
    private readonly alertCheckQueue: Queue<AlertCheckJobPayload>,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  // FIX (queue explosion): deduplicated by campaign+platform+date — one check per day max
  private async enqueueAlertCheck(
    tenantId: string, campaignId: string, campaignName: string, platform: string,
  ): Promise<void> {
    const dateStr = new Date().toISOString().slice(0, 10);
    const jobId = `alert-check:${tenantId}:${campaignId}:${platform}:${dateStr}`;
    try {
      await this.alertCheckQueue.add(
        'check',
        { tenantId, campaignId, campaignName, platform },
        { jobId, delay: 2_000 }, // 2s delay — let upsert fully commit first
      );
    } catch {
      // Non-critical — never fail a sync because alert check couldn't be queued
    }
  }

  // ─── Job router ────────────────────────────────────────────────────────────

  async process(job: Job<SyncJobPayload>): Promise<void> {
    switch (job.data.platform) {
      case IntegrationPlatform.GA4:
        return this.syncGa4(job);
      case IntegrationPlatform.GOOGLE_ADS:
        return this.syncGoogleAds(job);
      case IntegrationPlatform.META_ADS:
        return this.syncMetaAds(job);
      case IntegrationPlatform.GOOGLE_SEARCH_CONSOLE:
        return this.syncGsc(job);
      case IntegrationPlatform.YOUTUBE_ANALYTICS:
        return this.syncYoutube(job);
      case IntegrationPlatform.LINKEDIN_ADS:
        return this.syncLinkedinAds(job);
      case IntegrationPlatform.TIKTOK_ADS:
        return this.syncTiktokAds(job);
      case IntegrationPlatform.AMAZON_ADS:
        return this.syncAmazonAds(job);
      default:
        this.logger.warn(`[${job.id}] Unknown platform: ${job.data.platform} — skipping`);
    }
  }

  // ─── @OnWorkerEvent('failed') — marks ERROR after all retries exhausted ───
  // Sharp edge 2: only mark ERROR after all attempts are used up (not on every failure).
  // 401 errors return early without rethrowing, so they never reach this handler.

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SyncJobPayload>, error: Error): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 3;
    const { tenantId, campaignId, platform } = job.data;

    // Log every failure attempt for observability
    this.logger.warn(
      `[${job.id}] Attempt ${job.attemptsMade}/${maxAttempts} failed — platform=${platform} campaign=${campaignId}`,
      { tenantId, campaignId, platform, error: error.message, stack: error.stack },
    );

    if (job.attemptsMade >= maxAttempts) {
      await this.tenantContext.run(tenantId, async () => {
        await this.integrationsService.markError(tenantId, campaignId, platform, error.message);
      });

      void this.notifications.notifyAdmins(tenantId, {
        type: 'SYNC_FAILED',
        title: `Sync failed: ${platform}`,
        message: `Data sync for ${platform} failed after ${maxAttempts} attempts. Reconnect the integration if the issue persists.`,
        resourceType: 'Integration',
        resourceId: campaignId,
      });

      this.logger.error(
        `[${job.id}] DLQ: all ${maxAttempts} attempts exhausted — marked ERROR`,
        {
          tenantId,
          campaignId,
          platform,
          jobId: job.id,
          error: error.message,
          stack: error.stack,
          data: job.data,
        },
      );
    }
  }

  // ─── GA4 ──────────────────────────────────────────────────────────────────

  private async syncGa4(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      // Validate campaign + client still active, get externalAccountId
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return; // logged inside getActiveConnection

      // Fix 6: Never log accessToken — only log correlation ID, platform, dateRange
      let accessToken: string;
      try {
        accessToken = await this.ga4OAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] GA4 token refresh failed — marked EXPIRED`, {
          tenantId, campaignId, platform,
        });
        return; // Suppress retry — user must re-connect
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const result = await this.ga4Api.fetchCoreMetrics(
          accessToken,
          connection.externalAccountId!,
          { startDate: dateRange.from, endDate: dateRange.to },
        );

        // Convert GA4 rows → MetricRowInput[]
        // GA4 date format is YYYYMMDD → convert to YYYY-MM-DD
        const metricRows: MetricRowInput[] = [];
        for (const row of result.rows) {
          const rawDate = row.dimensions.date; // e.g. '20240115'
          const recordedAt = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;

          for (const [metricKey, value] of Object.entries(row.metrics)) {
            metricRows.push({ metricKey, value, recordedAt });
          }
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] GA4 sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform,
          dateRange, rowCount: result.rowCount,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Google Ads ────────────────────────────────────────────────────────────

  private async syncGoogleAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.googleAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Google Ads token refresh failed — marked EXPIRED`, {
          tenantId, campaignId, platform,
        });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const result = await this.googleAdsApi.fetchCampaignPerformance(
          accessToken,
          connection.externalAccountId!,
          { startDate: dateRange.from, endDate: dateRange.to },
        );

        // Convert Google Ads rows → MetricRowInput[]
        // Google Ads metric fields: clicks, impressions, ctr, average_cpc, cost_micros, conversions
        // segments.date is YYYY-MM-DD
        const googleAdsMetricFields = ['clicks', 'impressions', 'ctr', 'average_cpc', 'cost_micros', 'conversions'];
        const metricRows: MetricRowInput[] = [];
        for (const row of result.rows) {
          const recordedAt = String(row['segments.date'] ?? row['date'] ?? '');
          if (!recordedAt) continue;

          for (const field of googleAdsMetricFields) {
            const rawKey = `metrics.${field}`;
            const value = row[rawKey] ?? row[field];
            if (value == null) continue;
            metricRows.push({ metricKey: field, value: String(value), recordedAt });
          }
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Google Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform,
          dateRange, rowCount: result.rows.length,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Meta Ads ─────────────────────────────────────────────────────────────

  private async syncMetaAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      // Meta has no refresh token — getValidAccessToken throws if expired
      let accessToken: string;
      try {
        accessToken = await this.metaAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Meta Ads token expired — marked EXPIRED`, {
          tenantId, campaignId, platform,
        });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.metaAdsApi.fetchCampaignInsights(
          accessToken,
          connection.externalAccountId!,
          { since: dateRange.from, until: dateRange.to },
        );

        // Convert Meta Ads rows → MetricRowInput[]
        // Meta returns date_start as YYYY-MM-DD; metric fields: impressions, clicks, spend, ctr, cpc, conversions
        const metaMetricFields = ['impressions', 'clicks', 'spend', 'ctr', 'cpc', 'conversions'];
        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          const recordedAt = row.date_start ?? '';
          if (!recordedAt) continue;

          for (const field of metaMetricFields) {
            const value = row[field];
            if (value == null) continue;
            metricRows.push({ metricKey: field, value: String(value), recordedAt });
          }
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Meta Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform,
          dateRange, rowCount: rows.length,
          durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Google Search Console ────────────────────────────────────────────────

  private async syncGsc(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.gscOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] GSC token refresh failed — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.gscApi.queryAnalytics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        // GSC metrics: clicks, impressions, ctr, position — all keyed by date
        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'ctr', value: String(row.ctr), recordedAt: row.date },
            { metricKey: 'position', value: String(row.position), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] GSC sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── YouTube Analytics ────────────────────────────────────────────────────

  private async syncYoutube(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.youtubeOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] YouTube token refresh failed — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.youtubeApi.fetchCoreMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'views', value: String(row.views), recordedAt: row.date },
            { metricKey: 'estimatedMinutesWatched', value: String(row.estimatedMinutesWatched), recordedAt: row.date },
            { metricKey: 'averageViewDuration', value: String(row.averageViewDuration), recordedAt: row.date },
            { metricKey: 'likes', value: String(row.likes), recordedAt: row.date },
            { metricKey: 'comments', value: String(row.comments), recordedAt: row.date },
            { metricKey: 'subscribersGained', value: String(row.subscribersGained), recordedAt: row.date },
            { metricKey: 'subscribersLost', value: String(row.subscribersLost), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] YouTube sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── LinkedIn Ads ─────────────────────────────────────────────────────────

  private async syncLinkedinAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.linkedinAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] LinkedIn Ads token expired — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.linkedinAdsApi.fetchDailyMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          if (!row.date) continue;
          metricRows.push(
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'spend', value: String(row.costInLocalCurrency), recordedAt: row.date },
            { metricKey: 'conversions', value: String(row.externalWebsiteConversions), recordedAt: row.date },
            { metricKey: 'videoViews', value: String(row.videoViews), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] LinkedIn Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── TikTok Ads ───────────────────────────────────────────────────────────

  private async syncTiktokAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      // TikTok has no refresh token — getValidAccessToken throws if expired
      let accessToken: string;
      try {
        accessToken = await this.tiktokAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] TikTok Ads token expired (24h) — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.tiktokAdsApi.fetchCampaignMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'spend', value: String(row.spend), recordedAt: row.date },
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'ctr', value: String(row.ctr), recordedAt: row.date },
            { metricKey: 'cpc', value: String(row.cpc), recordedAt: row.date },
            { metricKey: 'conversions', value: String(row.conversion), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] TikTok Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Amazon Ads ───────────────────────────────────────────────────────────
  // Amazon Ads uses async report generation with polling (within the job).
  // ProfileId stored as externalAccountId. Reports typically complete in 30–60s.

  private async syncAmazonAds(job: Job<SyncJobPayload>): Promise<void> {
    const { tenantId, campaignId, platform, dateRange } = job.data;
    const startTime = Date.now();

    await this.tenantContext.run(tenantId, async () => {
      const connection = await this.getActiveConnection(job.id!, tenantId, campaignId, platform);
      if (!connection) return;

      let accessToken: string;
      try {
        accessToken = await this.amazonAdsOAuth.getValidAccessToken(tenantId, campaignId);
      } catch (err) {
        await this.integrationsService.markExpired(tenantId, campaignId, platform, (err as Error).message);
        this.logger.error(`[${job.id}] Amazon Ads token refresh failed — marked EXPIRED`, { tenantId, campaignId, platform });
        return;
      }

      await this.executeWithErrorHandling(job, tenantId, campaignId, platform, async () => {
        const rows = await this.amazonAdsApi.fetchDailyMetrics(
          accessToken,
          connection.externalAccountId!,
          dateRange.from,
          dateRange.to,
        );

        const metricRows: MetricRowInput[] = [];
        for (const row of rows) {
          metricRows.push(
            { metricKey: 'impressions', value: String(row.impressions), recordedAt: row.date },
            { metricKey: 'clicks', value: String(row.clicks), recordedAt: row.date },
            { metricKey: 'spend', value: String(row.spend), recordedAt: row.date },
            { metricKey: 'sales', value: String(row.sales), recordedAt: row.date },
            { metricKey: 'orders', value: String(row.orders), recordedAt: row.date },
          );
        }

        await this.metricsService.upsertMetrics(tenantId, campaignId, platform, metricRows);
        void this.enqueueAlertCheck(tenantId, campaignId, job.data.campaignName, String(platform));

        this.logger.log(`[${job.id}] Amazon Ads sync complete — ${metricRows.length} metric rows stored`, {
          tenantId, campaignId, platform, durationMs: Date.now() - startTime,
        });
      });
    });
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  /**
   * Validates:
   *   1. IntegrationConnection exists with status = CONNECTED
   *   2. Fix 3: externalAccountId is set (skip with warning if not — no status change)
   *   3. Campaign + client are still active (not soft-deleted)
   *
   * Returns null (and logs) if any check fails — caller returns early.
   */
  private async getActiveConnection(
    jobId: string,
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
  ): Promise<{ externalAccountId: string | null } | null> {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { campaignId, platform, tenantId, status: ConnectionStatus.CONNECTED },
      select: { externalAccountId: true },
    });

    if (!connection) {
      this.logger.warn(`[${jobId}] No CONNECTED integration — skipping`, {
        tenantId, campaignId, platform,
      });
      return null;
    }

    // Fix 3: externalAccountId not set = user connected OAuth but never picked a property
    // Skip silently — no status change, no error. User needs to configure in the UI.
    if (!connection.externalAccountId) {
      this.logger.warn(`[${jobId}] externalAccountId not configured — skipping`, {
        tenantId, campaignId, platform,
      });
      return null;
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId, deletedAt: null, client: { deletedAt: null } },
      select: { id: true },
    });

    if (!campaign) {
      this.logger.warn(`[${jobId}] Campaign or client deleted — skipping`, {
        tenantId, campaignId, platform,
      });
      return null;
    }

    return connection;
  }

  /**
   * Wraps the actual API call:
   *   - 401 / invalid_grant → markExpired, suppress retry (return without throw)
   *   - 429 → rethrow (BullMQ retries with jitter backoff)
   *   - 5xx / network → rethrow (BullMQ retries; @OnWorkerEvent('failed') marks ERROR)
   *   - success → markSynced
   *
   * Sharp edge 2: precise status classification enforced here.
   */
  private async executeWithErrorHandling(
    job: Job<SyncJobPayload>,
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
      await this.integrationsService.markSynced(tenantId, campaignId, platform);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status: number | undefined = (err as any)?.response?.status ?? (err as any)?.status;
      const message: string = (err as Error).message ?? 'Unknown error';

      if (status === 401 || message.includes('invalid_grant')) {
        // Sharp edge 2: 401 → EXPIRED — no retry
        await this.integrationsService.markExpired(tenantId, campaignId, platform, message);
        this.logger.error(`[${job.id}] 401 response — marked EXPIRED (no retry)`, {
          tenantId, campaignId, platform,
        });
        return; // Suppress — do NOT rethrow, do not retry
      }

      if (status === 429) {
        // Sharp edge 2: 429 → retry with backoff, do NOT mark ERROR yet
        this.logger.warn(`[${job.id}] 429 rate limit — will retry`, {
          tenantId, campaignId, platform,
        });
        throw err; // BullMQ applies jitter backoff and retries
      }

      // 5xx / network — log and rethrow; @OnWorkerEvent('failed') marks ERROR
      // after all attempts are exhausted
      this.logger.error(`[${job.id}] API error — will retry (attempt ${job.attemptsMade + 1})`, {
        tenantId, campaignId, platform, error: message,
      });
      throw err;
    }
  }
}
