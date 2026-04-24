import { IntegrationPlatform } from '@prisma/client';

/**
 * Converts a Date to YYYY-MM-DD (UTC).
 * No time component — ensures consistent jobId generation.
 */
export function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fix 5: Default date range = last 7 days (UTC).
 * Catches gaps from failed syncs; yesterday-only would miss them.
 */
export function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const to   = toYMD(now);
  const from = toYMD(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  return { from, to };
}

/**
 * Fix 1 + Sharp edge 1: Canonical, deterministic job ID.
 *
 * Rules enforced here:
 *  - from/to always sliced to YYYY-MM-DD (strips any time component)
 *  - from <= to (canonical ordering prevents duplicate IDs for same window)
 *
 * BullMQ treats duplicate jobIds as no-ops — safe to dispatch multiple times.
 */
export function buildSyncJobId(
  tenantId: string,
  campaignId: string,
  platform: IntegrationPlatform,
  from: string,
  to: string,
): string {
  const f = from.slice(0, 10);
  const t = to.slice(0, 10);
  // Enforce canonical order: always smaller date first
  const [start, end] = f <= t ? [f, t] : [t, f];
  // BullMQ v4 forbids colons in custom jobIds (used internally in Redis keys).
  // Use pipe as separator — unambiguous since none of the fields contain pipes.
  return `${tenantId}|${campaignId}|${platform}|${start}|${end}`;
}
