import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SystemPrismaService } from '../../../database/system-prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { MetricsService } from '../../metrics/metrics.service';
import { EmailService } from '../../email/email.service';
import { MetricAggregate } from '../../metrics/dto/query-metrics.dto';
import { computePriorPeriod } from '../../../common/metrics-utils';
import { ALERT_CHECK_QUEUE } from '../constants/alert-queue.constants';
import { NotificationsService } from '../../notifications/notifications.service';

export interface AlertCheckJobPayload {
  tenantId: string;
  campaignId: string;
  campaignName: string;
  platform: string;
}

interface AlertRow {
  id: string;
  tenantId: string;
  campaignId: string;
  name: string;
  metricKey: string;
  condition: string;
  threshold: number;
  periodType: string;
  severity: string;
  recipientEmails: string[];
  cooldownHours: number;
  lastTriggeredAt: Date | null;
}

@Processor(ALERT_CHECK_QUEUE, { concurrency: 5 })
export class AlertCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertCheckProcessor.name);

  constructor(
    private readonly systemPrisma: SystemPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly metricsService: MetricsService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<AlertCheckJobPayload>): Promise<void> {
    const { tenantId, campaignId, campaignName, platform } = job.data;

    await this.tenantContext.run(tenantId, async () => {
      await this.runChecks(tenantId, campaignId, campaignName, platform);
    });
  }

  private async runChecks(
    tenantId: string,
    campaignId: string,
    campaignName: string,
    platform: string,
  ): Promise<void> {
    // Fetch all active alerts for this campaign+platform
    const alerts: AlertRow[] = await (this.systemPrisma as any).alert.findMany({
      where: { tenantId, campaignId, platform, isActive: true, deletedAt: null },
    });

    if (alerts.length === 0) return;

    // FIX #3/#7: Group by period_type — one MetricSummary call per group
    const byPeriod = new Map<string, AlertRow[]>();
    for (const alert of alerts) {
      const key = alert.periodType;
      if (!byPeriod.has(key)) byPeriod.set(key, []);
      byPeriod.get(key)!.push(alert);
    }

    const today = new Date().toISOString().slice(0, 10);
    const triggered: Array<{ alert: AlertRow; currentValue: number }> = [];

    for (const [periodType, group] of byPeriod) {
      const { from, to } = this.periodRange(periodType, today);

      // One summary call per group (N+1 fix — not per alert)
      const metricKeys = [...new Set(group.map(a => a.metricKey))];
      const current = await this.metricsService.getMetricSummary(
        tenantId, campaignId, platform as any, from, to, metricKeys, MetricAggregate.SUM,
      );

      // For PERCENT_CHANGE conditions, fetch prior period once per group
      const needsPrior = group.some(a =>
        a.condition === 'PERCENT_CHANGE_ABOVE' || a.condition === 'PERCENT_CHANGE_BELOW',
      );

      let prior: Record<string, number> = {};
      if (needsPrior) {
        const priorRange = computePriorPeriod(from, to);
        const priorResult = await this.metricsService.getMetricSummary(
          tenantId, campaignId, platform as any,
          priorRange.from, priorRange.to, metricKeys, MetricAggregate.SUM,
        );
        prior = priorResult.metrics;
      }

      for (const alert of group) {
        // Skip if within cooldown window
        if (this.withinCooldown(alert)) continue;

        const currentValue = current.metrics[alert.metricKey] ?? 0;
        const fired = this.evaluate(alert, currentValue, prior[alert.metricKey] ?? 0);

        if (fired) {
          triggered.push({ alert, currentValue });
        }
      }
    }

    if (triggered.length === 0) return;

    // FIX #3: One batched email per campaign, not one per alert
    const allRecipients = [
      ...new Set(triggered.flatMap(t => t.alert.recipientEmails)),
    ];

    if (allRecipients.length > 0) {
      await this.sendBatchAlertEmail(
        tenantId, campaignId, campaignName, platform, triggered, allRecipients,
      ).catch(err =>
        this.logger.error(`Alert email failed for campaign ${campaignId}: ${String(err)}`),
      );
    }

    // Persist events and update lastTriggeredAt
    const now = new Date();
    for (const { alert, currentValue } of triggered) {
      await (this.systemPrisma as any).alertEvent.create({
        data: {
          tenantId,
          alertId: alert.id,
          campaignId,
          triggeredValue: currentValue,
          thresholdValue: alert.threshold,
          condition: alert.condition,
          severity: alert.severity,
          emailsSent: allRecipients,
          notifiedAt: now,
        },
      });

      await (this.systemPrisma as any).alert.update({
        where: { id: alert.id },
        data: { lastTriggeredAt: now },
      });
    }

    // In-app notifications for admins
    const criticals = triggered.filter(t => t.alert.severity === 'CRITICAL');
    const title = criticals.length > 0
      ? `🚨 ${criticals.length} critical alert(s) for ${campaignName}`
      : `⚠️ ${triggered.length} alert(s) fired for ${campaignName}`;
    const message = triggered
      .map(t => `${t.alert.name}: ${t.currentValue} (threshold ${t.alert.threshold})`)
      .join(', ');

    void this.notifications.notifyAdmins(tenantId, {
      type: 'ALERT_TRIGGERED',
      title,
      message,
      resourceType: 'Campaign',
      resourceId: campaignId,
    });

    this.logger.log(
      `Alert check: ${triggered.length} alerts fired for campaign ${campaignId} (${platform})`,
    );
  }

  // ─── Condition evaluation (FIX #2: zero-division guard) ────────────────────

  private evaluate(alert: AlertRow, current: number, prior: number): boolean {
    const threshold = Number(alert.threshold);

    switch (alert.condition) {
      case 'ABOVE': return current > threshold;
      case 'BELOW': return current < threshold;
      case 'PERCENT_CHANGE_ABOVE':
      case 'PERCENT_CHANGE_BELOW': {
        if (prior === 0) return false; // FIX #2: zero prior = no baseline, skip
        const changePct = ((current - prior) / prior) * 100;
        return alert.condition === 'PERCENT_CHANGE_ABOVE'
          ? changePct > threshold
          : changePct < threshold;
      }
      default: return false;
    }
  }

  // ─── Cooldown check ─────────────────────────────────────────────────────────

  private withinCooldown(alert: AlertRow): boolean {
    if (!alert.lastTriggeredAt) return false;
    const diffMs = Date.now() - alert.lastTriggeredAt.getTime();
    return diffMs < alert.cooldownHours * 3_600_000;
  }

  // ─── Period range (UTC, inclusive) ─────────────────────────────────────────

  private periodRange(periodType: string, today: string): { from: string; to: string } {
    if (periodType === 'WEEKLY') {
      const end = new Date(today + 'T00:00:00Z');
      const start = new Date(end.getTime() - 6 * 86_400_000);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    return { from: today, to: today };
  }

  // ─── Batch email ─────────────────────────────────────────────────────────────

  private async sendBatchAlertEmail(
    tenantId: string,
    campaignId: string,
    campaignName: string,
    platform: string,
    triggered: Array<{ alert: AlertRow; currentValue: number }>,
    recipients: string[],
  ): Promise<void> {
    // Build plain summary subject
    const criticalCount = triggered.filter(t => t.alert.severity === 'CRITICAL').length;
    const subject = criticalCount > 0
      ? `[CRITICAL] ${criticalCount} alert(s) fired — ${campaignName}`
      : `[Alert] ${triggered.length} alert(s) fired — ${campaignName}`;

    const lines = triggered.map(({ alert, currentValue }) =>
      `• [${alert.severity}] ${alert.name}: ${alert.metricKey} = ${currentValue} (threshold: ${alert.threshold})`,
    ).join('\n');

    // Reuse sendReportDelivery signature style — inline simple HTML
    const html = `
      <h2>Campaign Alert — ${campaignName}</h2>
      <p><strong>Platform:</strong> ${platform}</p>
      <p>The following alerts were triggered:</p>
      <ul>
        ${triggered.map(({ alert, currentValue }) => `
          <li>
            <strong>[${alert.severity}] ${alert.name}</strong><br/>
            Metric: <code>${alert.metricKey}</code> &nbsp;|&nbsp;
            Value: <strong>${currentValue}</strong> &nbsp;|&nbsp;
            Condition: ${alert.condition.replace(/_/g, ' ')} ${alert.threshold}
          </li>
        `).join('')}
      </ul>
      <p style="color:#888;font-size:12px">AgencyPulse Alert System</p>
    `;

    await this.emailService.sendRaw(recipients, subject, html);
  }
}
