/**
 * Shared utilities for period computation, change calculations, and status thresholds.
 * Used by scorecard, goals, and any future feature that compares metric periods.
 *
 * Time boundary convention (inclusive on both ends — matches MetricsService SQL):
 *   recorded_at >= $from::date AND recorded_at <= $to::date
 */

// ─── Period helpers ────────────────────────────────────────────────────────────

/**
 * Computes the immediately preceding period of the same duration.
 * E.g. Apr 1–30 (30 days) → Mar 2–31 (30 days prior).
 * Both input and output are YYYY-MM-DD strings.
 */
export function computePriorPeriod(from: string, to: string): { from: string; to: string } {
  const startMs = Date.UTC(
    parseInt(from.slice(0, 4), 10),
    parseInt(from.slice(5, 7), 10) - 1,
    parseInt(from.slice(8, 10), 10),
  );
  const endMs = Date.UTC(
    parseInt(to.slice(0, 4), 10),
    parseInt(to.slice(5, 7), 10) - 1,
    parseInt(to.slice(8, 10), 10),
  );

  // Duration in ms (inclusive: e.g. Apr 1–30 = 30 days = 30 * 86400000)
  const durationMs = endMs - startMs + 86_400_000;

  const priorEndMs = startMs - 86_400_000;         // day before current start
  const priorStartMs = priorEndMs - durationMs + 86_400_000; // same length prior

  return {
    from: msToDateString(priorStartMs),
    to: msToDateString(priorEndMs),
  };
}

function msToDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ─── Change calculations ───────────────────────────────────────────────────────

/** Returns change as a decimal fraction (0.12 = +12%). Null when prior is 0. */
export function computeChangePct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return (current - prior) / prior;
}

// ─── Scorecard status thresholds ──────────────────────────────────────────────

// GOOD    ≥ -5%  (maintained or grew)
// WARNING  -5% to -15%  (slight decline)
// BAD     < -15%  (significant decline)

export type ScorecardStatus = 'GOOD' | 'WARNING' | 'BAD' | 'NEW';

export function scorecardStatus(changePct: number | null): ScorecardStatus {
  if (changePct === null) return 'NEW';
  if (changePct >= -0.05) return 'GOOD';
  if (changePct >= -0.15) return 'WARNING';
  return 'BAD';
}

// ─── Goal progress status thresholds ─────────────────────────────────────────

// ACHIEVED  ≥ 100%
// ON_TRACK  ≥  70%
// AT_RISK   ≥  40%
// BEHIND    <  40%

export type GoalStatus = 'ACHIEVED' | 'ON_TRACK' | 'AT_RISK' | 'BEHIND';

export function goalProgressStatus(progressFraction: number): GoalStatus {
  if (progressFraction >= 1) return 'ACHIEVED';
  if (progressFraction >= 0.7) return 'ON_TRACK';
  if (progressFraction >= 0.4) return 'AT_RISK';
  return 'BEHIND';
}
