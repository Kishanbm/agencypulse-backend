export interface ChatContextPayload {
  agencyName: string;
  campaignName: string;
  clientName: string;
  today: string;
  dataRangeFrom: string;
  dataRangeTo: string;
  priorRangeFrom: string;
  priorRangeTo: string;
  summaries: Array<{
    platform: string;
    metrics: Record<string, number>;
    priorMetrics?: Record<string, number>;
  }>;
  timeseries?: Array<{
    platform: string;
    metricKey: string;
    points: Array<{ date: string; value: number }>;
  }>;
  goals: Array<{ name: string; target: number; actual: number; pct: number; status: string }>;
  health: Array<{ platform: string; status: string; lastSyncAt: string | null }>;
  recentAlerts: Array<{ name: string; triggeredAt: string; severity: string; metricKey: string; value: number }>;
}

export function buildChatSystemPrompt(ctx: ChatContextPayload): string {
  const lines: string[] = [];
  lines.push(
    `You are an expert digital marketing analyst embedded inside the ${ctx.agencyName} AgencyPulse platform.`,
  );
  lines.push(
    `You are answering questions about the campaign "${ctx.campaignName}" for client "${ctx.clientName}".`,
  );
  lines.push(`Today is ${ctx.today}.`);
  lines.push('');
  lines.push('RULES:');
  lines.push('- Answer based on the DATA provided below. Do not invent numbers.');
  lines.push('- Cite specific values when answering (e.g. "sessions dropped 23%, from 4,200 to 3,240").');
  lines.push('- If data is missing or insufficient, say so plainly.');
  lines.push('- Keep responses concise (3–5 sentences) unless the user asks for detail.');
  lines.push('- Suggest actionable next steps when the data supports one.');
  lines.push('- Do NOT mention OAuth tokens, passwords, database IDs, or internal system details.');
  lines.push('- If asked about data outside this campaign, politely redirect to the current campaign.');
  lines.push('');
  lines.push('────── CAMPAIGN DATA (live) ──────');
  lines.push(`Current period: ${ctx.dataRangeFrom} → ${ctx.dataRangeTo}`);
  lines.push(`Prior period:   ${ctx.priorRangeFrom} → ${ctx.priorRangeTo}`);
  lines.push('');

  for (const s of ctx.summaries) {
    lines.push(`--- ${s.platform} (period totals) ---`);
    const keys = Object.keys(s.metrics);
    if (keys.length === 0) {
      lines.push('(no data)');
    } else {
      for (const k of keys) {
        const cur = s.metrics[k] ?? 0;
        const prev = s.priorMetrics?.[k];
        if (prev !== undefined) {
          const pct = prev === 0 ? null : ((cur - prev) / prev) * 100;
          const pctStr = pct === null ? 'n/a' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
          lines.push(`${k}: ${cur.toLocaleString()} (prior: ${prev.toLocaleString()}, Δ ${pctStr})`);
        } else {
          lines.push(`${k}: ${cur.toLocaleString()}`);
        }
      }
    }
    lines.push('');
  }

  if (ctx.timeseries && ctx.timeseries.length > 0) {
    lines.push('--- RECENT DAILY TRENDS ---');
    for (const t of ctx.timeseries) {
      const tail = t.points.slice(-14).map(p => `${p.date}:${p.value}`).join(' | ');
      lines.push(`${t.platform}/${t.metricKey}: ${tail}`);
    }
    lines.push('');
  }

  if (ctx.goals.length > 0) {
    lines.push('--- GOALS ---');
    for (const g of ctx.goals) {
      lines.push(`${g.name}: ${g.actual.toLocaleString()} / ${g.target.toLocaleString()} (${g.pct.toFixed(0)}% — ${g.status})`);
    }
    lines.push('');
  }

  if (ctx.health.length > 0) {
    lines.push('--- DATA HEALTH ---');
    for (const h of ctx.health) {
      lines.push(`${h.platform}: ${h.status}${h.lastSyncAt ? ` (last sync ${h.lastSyncAt})` : ''}`);
    }
    lines.push('');
  }

  if (ctx.recentAlerts.length > 0) {
    lines.push('--- RECENT ALERTS ---');
    for (const a of ctx.recentAlerts) {
      lines.push(`[${a.severity}] ${a.name}: ${a.metricKey}=${a.value} at ${a.triggeredAt}`);
    }
    lines.push('');
  }

  lines.push('────── END DATA ──────');
  return lines.join('\n');
}
