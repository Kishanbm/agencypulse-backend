import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IntegrationPlatform } from '@prisma/client';
import { SYNC_QUEUE, SYNC_JOB_NAMES } from './constants/sync-queue.constants';
import { SyncJobPayload } from './dto/sync-job.dto';
import { buildSyncJobId, defaultDateRange } from './utils/date.utils';

@Injectable()
export class SyncService {
  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Dispatches a single sync job for one platform.
   *
   * Fix 1: jobId is deterministic — BullMQ deduplicates automatically.
   * If the exact same window was already queued, the add is a no-op.
   *
   * Fix 5: dateRange defaults to last 7 days (not just yesterday).
   */
  async dispatchSync(
    tenantId: string,
    campaignId: string,
    platform: IntegrationPlatform,
    dateRange?: { from: string; to: string },
    delayMs = 0, // Platform staggering — GA4: 0ms, Google Ads: +2min, Meta Ads: +4min
    campaignName = '',
  ): Promise<void> {
    const jobName = SYNC_JOB_NAMES[platform];

    if (!jobName) {
      throw new BadRequestException(
        `Platform ${platform} does not have a registered sync processor.`,
      );
    }

    const range = dateRange ?? defaultDateRange();
    const jobId = buildSyncJobId(tenantId, campaignId, platform, range.from, range.to);

    const payload: SyncJobPayload = {
      tenantId,
      campaignId,
      campaignName,
      platform,
      dateRange: range,
    };

    // jobId doubles as correlation ID — visible in BullMQ dashboard + logs
    // delay enables per-platform staggering to avoid simultaneous API spikes
    await this.queue.add(jobName, payload, {
      jobId,
      ...(delayMs > 0 && { delay: delayMs }),
    });
  }

  /**
   * Dispatches sync jobs for all supported platforms on a campaign.
   * Skips platforms that have no registered processor (no throw).
   * Returns count of jobs successfully dispatched.
   */
  async dispatchCampaignSync(
    tenantId: string,
    campaignId: string,
    dateRange?: { from: string; to: string },
  ): Promise<number> {
    const supportedPlatforms = Object.keys(SYNC_JOB_NAMES) as IntegrationPlatform[];
    const results = await Promise.allSettled(
      supportedPlatforms.map((platform) =>
        this.dispatchSync(tenantId, campaignId, platform, dateRange),
      ),
    );
    return results.filter((r) => r.status === 'fulfilled').length;
  }
}
