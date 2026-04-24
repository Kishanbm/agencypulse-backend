import { Injectable, Logger, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationPlatform } from '@prisma/client';
import puppeteer, { Browser } from 'puppeteer';
import { MetricsService } from '../metrics/metrics.service';
import { MetricAggregate, MetricGranularity } from '../metrics/dto/query-metrics.dto';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../database/prisma.service';
import { ReportSectionDto } from './dto/section.dto';

const PDF_TIMEOUT_MS = 30_000;
const PDF_MAX_INLINE_BYTES = 10 * 1024 * 1024; // 10 MB

const BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

export interface RenderedReport {
  pdfBuffer: Buffer;
  pdfUrl: string;       // storage key
  fileSizeBytes: number;
}

@Injectable()
export class ReportRenderService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportRenderService.name);
  private browser: Browser | null = null;
  private browserLaunchPromise: Promise<Browser> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly storageService: StorageService,
    private readonly config: ConfigService,
  ) {}

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  async renderAndStore(
    tenantId: string,
    reportId: string,
    campaignId: string,
    reportName: string,
    sections: ReportSectionDto[],
    from: string,
    to: string,
  ): Promise<RenderedReport> {
    // Batch fetch all metrics grouped by platform — avoids N+1 queries
    const sectionData = await this.batchFetchSectionData(
      tenantId, campaignId, sections, from, to,
    );

    const html = this.buildHtml(reportName, sections, sectionData, from, to);
    const pdfBuffer = await this.generatePdf(html);

    const key = StorageService.buildPdfKey(tenantId, reportId);
    await this.storageService.upload(key, pdfBuffer, 'application/pdf');

    // Persist pdfUrl + pdfGeneratedAt back to report row
    await this.prisma.report.update({
      where: { id: reportId },
      data: { pdfUrl: key, pdfGeneratedAt: new Date() },
    });

    return { pdfBuffer, pdfUrl: key, fileSizeBytes: pdfBuffer.length };
  }

  // ─── Batch data fetch ───────────────────────────────────────────────────────

  private async batchFetchSectionData(
    tenantId: string,
    campaignId: string,
    sections: ReportSectionDto[],
    from: string,
    to: string,
  ): Promise<Map<string, any>> {
    // Group sections by platform so we make one query per platform, not per section
    const platformGroups = new Map<string, { sectionIds: string[]; metricKeys: Set<string> }>();

    for (const section of sections) {
      if (!section.platform || !section.metricKeys?.length) continue;
      if (!platformGroups.has(section.platform)) {
        platformGroups.set(section.platform, { sectionIds: [], metricKeys: new Set() });
      }
      const group = platformGroups.get(section.platform)!;
      group.sectionIds.push(section.id);
      section.metricKeys.forEach((k) => group.metricKeys.add(k));
    }

    const sectionDataMap = new Map<string, any>();

    // One MetricsService call per platform (not per section)
    await Promise.all(
      Array.from(platformGroups.entries()).map(async ([platform, group]) => {
        const [summary, timeSeries] = await Promise.all([
          this.metricsService.getMetricSummary(
            tenantId,
            campaignId,
            platform as IntegrationPlatform,
            from,
            to,
            Array.from(group.metricKeys),
            MetricAggregate.SUM,
          ),
          this.metricsService.getMetrics(
            tenantId,
            campaignId,
            platform as IntegrationPlatform,
            from,
            to,
            Array.from(group.metricKeys),
            MetricGranularity.DAY,
            MetricAggregate.SUM,
          ),
        ]);

        // Map results back to individual sections
        for (const section of sections) {
          if (section.platform === platform && section.metricKeys?.length) {
            sectionDataMap.set(section.id, {
              summary,
              timeSeries,
              metricKeys: section.metricKeys,
            });
          }
        }
      }),
    );

    return sectionDataMap;
  }

  // ─── HTML template ──────────────────────────────────────────────────────────

  private buildHtml(
    reportName: string,
    sections: ReportSectionDto[],
    sectionData: Map<string, any>,
    from: string,
    to: string,
  ): string {
    const sectionsHtml = sections
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((section) => this.renderSection(section, sectionData.get(section.id)))
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escape(reportName)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 6px; color: #111; }
    .date-range { font-size: 13px; color: #666; margin-bottom: 32px; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
    .metric-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .metric-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; }
    .metric-value { font-size: 22px; font-weight: 700; color: #111; }
    .text-content { font-size: 14px; line-height: 1.6; color: #374151; }
    .no-data { font-size: 13px; color: #9ca3af; font-style: italic; }
    footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: right; }
  </style>
</head>
<body>
  <h1>${this.escape(reportName)}</h1>
  <p class="date-range">Period: ${from} — ${to}</p>
  ${sectionsHtml}
  <footer>Generated by AgencyPulse · ${new Date().toUTCString()}</footer>
</body>
</html>`;
  }

  private renderSection(section: ReportSectionDto, data: any): string {
    if (section.type === 'TEXT') {
      return `<div class="section">
  <div class="section-title">${this.escape(section.title)}</div>
  <p class="text-content">${this.escape(section.content ?? '')}</p>
</div>`;
    }

    if (!data) {
      return `<div class="section">
  <div class="section-title">${this.escape(section.title)}</div>
  <p class="no-data">No data available for this section.</p>
</div>`;
    }

    // METRICS + CHART sections both show summary KPI cards
    const summary: Record<string, number> = data.summary ?? {};
    const metricKeys: string[] = data.metricKeys ?? [];
    const cards = metricKeys
      .map((key) => {
        const value = summary[key];
        const display = value !== undefined ? this.formatNumber(value) : '—';
        return `<div class="metric-card">
  <div class="metric-label">${this.escape(key.replace(/_/g, ' '))}</div>
  <div class="metric-value">${display}</div>
</div>`;
      })
      .join('\n');

    return `<div class="section">
  <div class="section-title">${this.escape(section.title)}</div>
  <div class="metrics-grid">${cards}</div>
</div>`;
  }

  // ─── Puppeteer ─────────────────────────────────────────────────────────────

  // Returns the shared browser instance, launching it if not yet started.
  // On crash/disconnect, clears the instance so the next call re-launches.
  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;

    // Prevent concurrent launches if multiple jobs start simultaneously
    if (!this.browserLaunchPromise) {
      this.browserLaunchPromise = puppeteer
        .launch({ headless: true, args: BROWSER_ARGS })
        .then((b) => {
          this.browser = b;
          b.on('disconnected', () => {
            this.browser = null;
            this.browserLaunchPromise = null;
          });
          return b;
        })
        .finally(() => {
          this.browserLaunchPromise = null;
        });
    }

    return this.browserLaunchPromise;
  }

  private async generatePdf(html: string): Promise<Buffer> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timed out after 30s')), PDF_TIMEOUT_MS),
    );

    const generate = async () => {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfUint8 = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
        return Buffer.from(pdfUint8);
      } finally {
        await page.close().catch(() => {});
      }
    };

    try {
      return await Promise.race([generate(), timeout]);
    } catch (err) {
      this.logger.error(`PDF generation failed: ${String(err)}`);
      throw new InternalServerErrorException('Failed to generate PDF report.');
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  isTooLargeForAttachment(fileSizeBytes: number): boolean {
    return fileSizeBytes > PDF_MAX_INLINE_BYTES;
  }

  private formatNumber(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(Math.round(value * 100) / 100);
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
