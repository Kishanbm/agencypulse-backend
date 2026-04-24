import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { MetricGranularity, MetricAggregate } from '../metrics/dto/query-metrics.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ExportQueryDto, ExportFormat } from './dto/export-query.dto';
import { streamCsv, sanitizeFilename } from './utils/csv-formatter';
import { buildXlsxBuffer } from './utils/xlsx-formatter';

// FIX #6: hard cap on export range to prevent memory explosion
const MAX_EXPORT_DAYS = 365;

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async export(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: ExportQueryDto,
    res: Response,
  ): Promise<void> {
    const campaign = await this.assertCampaignAccess(user, clientId, campaignId);
    this.assertDateRangeCap(dto.from, dto.to);

    const format = dto.format ?? ExportFormat.CSV;
    const granularity = dto.granularity ?? MetricGranularity.DAY;

    const timeSeries = await this.metrics.getMetrics(
      user.tenantId, campaignId, dto.platform,
      dto.from, dto.to, dto.metricKeys, granularity, MetricAggregate.SUM,
    );

    // Determine metric keys from data if not specified
    const metricKeys = dto.metricKeys?.length
      ? dto.metricKeys
      : timeSeries.length > 0 ? Object.keys(timeSeries[0].metrics) : [];

    const baseFilename = `${campaign.name}_${dto.platform}_${dto.from}_${dto.to}`;

    if (format === ExportFormat.CSV) {
      // FIX #6: stream row-by-row — no full string in memory
      streamCsv(res, baseFilename, timeSeries, metricKeys);
      return;
    }

    // XLSX: needs summary too
    const summaryResult = await this.metrics.getMetricSummary(
      user.tenantId, campaignId, dto.platform,
      dto.from, dto.to, metricKeys, MetricAggregate.SUM,
    );

    const { buffer, filename } = await buildXlsxBuffer(
      timeSeries, summaryResult.metrics, metricKeys, baseFilename,
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  async exportSummary(
    user: AuthenticatedUser,
    clientId: string,
    campaignId: string,
    dto: ExportQueryDto,
    res: Response,
  ): Promise<void> {
    const campaign = await this.assertCampaignAccess(user, clientId, campaignId);
    this.assertDateRangeCap(dto.from, dto.to);

    const format = dto.format ?? ExportFormat.CSV;
    const summary = await this.metrics.getMetricSummary(
      user.tenantId, campaignId, dto.platform,
      dto.from, dto.to, dto.metricKeys, MetricAggregate.SUM,
    );

    const metricKeys = Object.keys(summary.metrics);
    const baseFilename = `${campaign.name}_${dto.platform}_summary_${dto.from}_${dto.to}`;
    const safeFilename = sanitizeFilename(baseFilename);

    if (format === ExportFormat.CSV) {
      const header = ['Metric', 'Value'].join(',');
      const rows = metricKeys.map(k => `${k},${summary.metrics[k] ?? 0}`).join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.csv"`);
      res.end(header + '\r\n' + rows + '\r\n');
      return;
    }

    const { buffer, filename } = await buildXlsxBuffer(
      [], summary.metrics, metricKeys, baseFilename,
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async assertCampaignAccess(
    user: AuthenticatedUser, clientId: string, campaignId: string,
  ) {
    const isClient = user.role === UserRole.CLIENT_USER;
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId, clientId, tenantId: user.tenantId, deletedAt: null,
        ...(isClient && {
          client: { clientUserAssignments: { some: { userId: user.id } } },
        }),
      },
      select: { id: true, name: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');
    return campaign;
  }

  private assertDateRangeCap(from: string, to: string): void {
    const days = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    if (days > MAX_EXPORT_DAYS) {
      throw new BadRequestException(
        `Export range cannot exceed ${MAX_EXPORT_DAYS} days. Requested: ${Math.round(days)} days.`,
      );
    }
  }
}
