export const REPORT_SUMMARY_SYSTEM_PROMPT = `You are a senior digital marketing analyst writing the executive summary section of a client report for a marketing agency.

Your job: write a clear, professional narrative that explains what happened during the reporting period.

Rules:
- Be specific with numbers — cite exact values and percentages from the data provided
- Explain WHAT changed and HOW MUCH
- When the "why" is inferable from the data (e.g. cost dropped so clicks dropped), say so
- Do NOT fabricate data or speculate beyond what is provided
- Write 3–5 short paragraphs, clean prose — no bullet points, no markdown headers
- Start with the single most important finding (biggest win or biggest concern)
- End with a forward-looking recommendation if data supports one
- Do not mention tokens, OAuth, or internal system concepts
- Write in the voice of a marketing agency talking to their client`;

export interface ReportSummaryContext {
  campaignName: string;
  clientName: string;
  agencyName: string;
  periodFrom: string;
  periodTo: string;
  priorPeriodFrom: string;
  priorPeriodTo: string;
  platforms: Array<{
    platform: string;
    current: Record<string, number>;
    prior: Record<string, number>;
    changePct: Record<string, number | null>;
  }>;
  goals: Array<{ name: string; targetValue: number; currentValue: number; progressPct: number; status: string }>;
  healthStatus: Array<{ platform: string; status: string; lastSyncAt: string | null }>;
}

export function buildReportSummaryUserPrompt(ctx: ReportSummaryContext): string {
  const lines: string[] = [];
  lines.push(`Campaign: ${ctx.campaignName}`);
  lines.push(`Client: ${ctx.clientName}`);
  lines.push(`Period: ${ctx.periodFrom} → ${ctx.periodTo}`);
  lines.push(`Compared against: ${ctx.priorPeriodFrom} → ${ctx.priorPeriodTo}`);
  lines.push('');

  for (const p of ctx.platforms) {
    lines.push(`--- ${p.platform} ---`);
    const keys = Object.keys(p.current);
    for (const key of keys) {
      const cur = p.current[key] ?? 0;
      const prev = p.prior[key] ?? 0;
      const pct = p.changePct[key];
      const pctStr = pct === null ? 'n/a' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      lines.push(`${key}: ${cur.toLocaleString()} (prior: ${prev.toLocaleString()}, Δ ${pctStr})`);
    }
    lines.push('');
  }

  if (ctx.goals.length > 0) {
    lines.push('--- GOALS ---');
    for (const g of ctx.goals) {
      lines.push(
        `${g.name}: target ${g.targetValue.toLocaleString()}, actual ${g.currentValue.toLocaleString()} (${g.progressPct.toFixed(0)}% — ${g.status})`,
      );
    }
    lines.push('');
  }

  if (ctx.healthStatus.length > 0) {
    lines.push('--- DATA HEALTH ---');
    for (const h of ctx.healthStatus) {
      lines.push(`${h.platform}: ${h.status} (last sync: ${h.lastSyncAt ?? 'never'})`);
    }
    lines.push('');
  }

  lines.push('Write the executive summary now.');
  return lines.join('\n');
}
