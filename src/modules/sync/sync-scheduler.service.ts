import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { ConnectionStatus } from '@prisma/client';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { SyncService } from './sync.service';
import { toYMD } from './utils/date.utils';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max integrations dispatched per scheduler run. Remainder handled next cycle. */
const MAX_JOBS_PER_CYCLE = 500;

/** Dispatch in chunks — prevents Redis spike when thousands of jobs are queued at once. */
const BATCH_SIZE = 50;

/** Pause between batches in ms. */
const BATCH_PAUSE_MS = 200;

/** How far back to backfill on first sync (days). */
const BACKFILL_DAYS = 90;

/**
 * AI Fix 2: Cap per-run sync window to avoid massive API load on initial backfill.
 * A 90-day backfill across 1000 connections would exhaust platform rate limits.
 * Each run covers max 30 days; the next run picks up the remaining window.
 */
const MAX_WINDOW_DAYS = 30;

/** Re-sync last N days on incremental runs — catches late-arriving attribution data. */
const OVERLAP_DAYS = 1;

/**
 * AI Fix (optional): Platform staggering.
 * Spreads API calls across platforms to prevent simultaneous rate-limit spikes.
 * GA4 dispatched immediately; Google Ads +2min; Meta Ads +4min.
 */
const PLATFORM_DELAY_MS: Record<string, number> = {
  GA4:        0,
  GOOGLE_ADS: 2 * 60 * 1_000,
  META_ADS:   4 * 60 * 1_000,
};

// ─── Scheduler ────────────────────────────────────────────────────────────────

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    private readonly systemPrisma: SystemPrismaService,
    private readonly syncService: SyncService,
  ) {}

  /**
   * Scheduled integration data sync — runs every 6 hours by default.
   * Override with SYNC_CRON env var (standard cron expression).
   *
   * What it does:
   *   1. Queries ALL CONNECTED integrations across all tenants (SystemPrismaService)
   *   2. Orders by lastSyncAt ASC — never-synced connections are highest priority
   *   3. Caps to MAX_JOBS_PER_CYCLE — remainder handled next cycle
   *   4. Calculates incremental date range per connection
   *   5. Dispatches BullMQ jobs in batches of 50 with platform staggering
   *
   * Security:
   *   - Uses SystemPrismaService (no RLS) for cross-tenant query — reads metadata only
   *   - NO token fields selected — scheduler never touches encrypted data
   *   - Each dispatched job runs under tenant context (processor sets it via TenantContextService)
   */
  @Cron(process.env['SYNC_CRON'] ?? '0 */6 * * *')
  async runScheduledSync(): Promise<void> {
    // AI2 Fix: scheduler_run_id for end-to-end correlation across all log entries
    const runId = randomUUID().slice(0, 8);
    const startTime = Date.now();

    // Fix 1: toYMD always outputs YYYY-MM-DD UTC — no time component, no timezone drift
    const today = toYMD(new Date());

    this.logger.log(`[run:${runId}] Scheduler triggered`, { today });

    // AI Fix: query only CONNECTED + campaign/client not soft-deleted before dispatching
    // OrderBy lastSyncAt ASC — null values (never synced) sort first = highest priority
    // Take MAX_JOBS_PER_CYCLE — remaining connections handled next cycle
    const connections = await this.systemPrisma.integrationConnection.findMany({
      where: {
        status: ConnectionStatus.CONNECTED,
        campaign: {
          deletedAt: null,
          client: { deletedAt: null },
        },
      },
      select: {
        tenantId: true,
        campaignId: true,
        platform: true,
        lastSyncAt: true,
        // NO token fields — scheduler must never access encrypted data
      },
      orderBy: { lastSyncAt: 'asc' }, // null first in Prisma ascending = never-synced first
      take: MAX_JOBS_PER_CYCLE,
    });

    this.logger.log(`[run:${runId}] Found ${connections.length} connections to sync`);

    if (connections.length === 0) {
      this.logger.log(`[run:${runId}] Nothing to sync — exiting early`);
      return;
    }

    let dispatched = 0;
    let failed = 0;

    // Dispatch in batches — prevents Redis spike with large connection counts
    for (let i = 0; i < connections.length; i += BATCH_SIZE) {
      const batch = connections.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (conn) => {
          const dateRange = this.calculateDateRange(conn.lastSyncAt, today);
          const delayMs = PLATFORM_DELAY_MS[conn.platform] ?? 0;

          await this.syncService.dispatchSync(
            conn.tenantId,
            conn.campaignId,
            conn.platform,
            dateRange,
            delayMs,
          );
        }),
      );

      const batchDispatched = results.filter((r) => r.status === 'fulfilled').length;
      const batchFailed     = results.filter((r) => r.status === 'rejected').length;

      dispatched += batchDispatched;
      failed     += batchFailed;

      if (batchFailed > 0) {
        const errors = results
          .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
          .map((r) => (r.reason as Error).message)
          .join(', ');
        this.logger.warn(
          `[run:${runId}] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchFailed} dispatch failures`,
          { errors },
        );
      }

      // Pause between batches — not after the last batch
      if (i + BATCH_SIZE < connections.length) {
        await sleep(BATCH_PAUSE_MS);
      }
    }

    this.logger.log(`[run:${runId}] Scheduler complete`, {
      dispatched,
      failed,
      total: connections.length,
      durationMs: Date.now() - startTime,
    });
  }

  // ─── Date range calculation ────────────────────────────────────────────────

  /**
   * Calculates the sync date range for a single connection.
   *
   * AI Fix 2: Window capped at MAX_WINDOW_DAYS (30 days) per run.
   *
   * Never synced:
   *   from = max(today - 90d,  today - 30d)  → first run covers last 30 days
   *   next runs walk back 30 days each until 90 days is covered
   *
   * Previously synced:
   *   from = max(lastSyncAt - 1d,  today - 30d)  → incremental + 1-day overlap
   *   to   = today
   *
   * Why 1-day overlap? GA4 and Google Ads back-fill conversion data up to 2 days
   * after a session. Without overlap, attribution corrections are silently missed.
   */
  private calculateDateRange(
    lastSyncAt: Date | null,
    today: string,
  ): { from: string; to: string } {
    const todayMs   = new Date(today).getTime();
    const maxWindowMs = MAX_WINDOW_DAYS * 24 * 60 * 60 * 1_000;

    let fromMs: number;

    if (!lastSyncAt) {
      // Never synced — walk back from today, capped to MAX_WINDOW_DAYS per run
      const backfillStart = todayMs - BACKFILL_DAYS * 24 * 60 * 60 * 1_000;
      fromMs = Math.max(backfillStart, todayMs - maxWindowMs);
    } else {
      // Incremental — from lastSyncAt minus overlap, capped to MAX_WINDOW_DAYS
      const withOverlap = lastSyncAt.getTime() - OVERLAP_DAYS * 24 * 60 * 60 * 1_000;
      fromMs = Math.max(withOverlap, todayMs - maxWindowMs);
    }

    return {
      from: toYMD(new Date(fromMs)),
      to: today,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
