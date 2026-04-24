import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// Optional per-agency sender — name and address override the platform default
export interface AgencyFrom {
  name: string;       // e.g. "Acme Marketing"
  address?: string;   // e.g. "reports@myagency.com" — only if agency has set emailFromAddress
}

export interface InviteStaffEmailContext {
  agencyName: string;
  inviterName: string;
  inviteeName: string;
  acceptUrl: string;
  expiresInHours: number;
}

export interface WelcomeEmailContext {
  firstName: string;
  agencyName: string;
  loginUrl: string;
}

export interface ReportDeliveryEmailContext {
  agencyName: string;
  reportName: string;
  from: string;
  to: string;
  hasAttachment: boolean;
  downloadUrl?: string;
}

export interface InviteClientUserEmailContext {
  agencyName: string;
  inviteeName: string;
  clientName: string;
  acceptUrl: string;
  expiresInHours: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly templateCache = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('email.from')!;

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('email.smtp.host'),
      port: this.config.get<number>('email.smtp.port'),
      secure: this.config.get<number>('email.smtp.port') === 465,
      auth: {
        user: this.config.get<string>('email.smtp.user'),
        pass: this.config.get<string>('email.smtp.pass'),
      },
    });
  }

  async sendInviteStaff(to: string, ctx: InviteStaffEmailContext, agencyFrom?: AgencyFrom): Promise<void> {
    await this.send(to, `You're invited to join ${ctx.agencyName}`, 'invite-staff', ctx as unknown as Record<string, unknown>, agencyFrom);
  }

  async sendWelcome(to: string, ctx: WelcomeEmailContext, agencyFrom?: AgencyFrom): Promise<void> {
    await this.send(to, `Welcome to ${ctx.agencyName}!`, 'welcome', ctx as unknown as Record<string, unknown>, agencyFrom);
  }

  async sendInviteClientUser(to: string, ctx: InviteClientUserEmailContext, agencyFrom?: AgencyFrom): Promise<void> {
    await this.send(to, `Access your reports on ${ctx.agencyName}`, 'invite-client-user', ctx as unknown as Record<string, unknown>, agencyFrom);
  }

  async sendRaw(to: string[], subject: string, html: string, agencyFrom?: AgencyFrom): Promise<void> {
    const from = agencyFrom
      ? agencyFrom.address
        ? `"${agencyFrom.name}" <${agencyFrom.address}>`
        : `"${agencyFrom.name}" <${this.from.includes('<') ? this.from.match(/<(.+)>/)![1] : this.from}>`
      : this.from;
    try {
      await this.transporter.sendMail({ from, to: to.join(', '), subject, html });
      this.logger.log(`Raw email sent to ${to.length} recipients — ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send raw email: ${String(err)}`);
      throw err;
    }
  }

  async sendReportDelivery(
    to: string[],
    subject: string,
    ctx: ReportDeliveryEmailContext,
    pdfAttachment?: { filename: string; content: Buffer },
    agencyFrom?: AgencyFrom,
  ): Promise<void> {
    const html = this.renderTemplate('report-delivery', ctx as unknown as Record<string, unknown>);
    const from = agencyFrom
      ? agencyFrom.address
        ? `"${agencyFrom.name}" <${agencyFrom.address}>`
        : `"${agencyFrom.name}" <${this.from.includes('<') ? this.from.match(/<(.+)>/)![1] : this.from}>`
      : this.from;
    try {
      await this.transporter.sendMail({
        from,
        to: to.join(', '),
        subject,
        html,
        attachments: pdfAttachment
          ? [{ filename: pdfAttachment.filename, content: pdfAttachment.content, contentType: 'application/pdf' }]
          : undefined,
      });
      this.logger.log(`Report delivery email sent to ${to.length} recipients`);
    } catch (err) {
      this.logger.error(`Failed to send report delivery email: ${String(err)}`);
      throw err; // Re-throw so BullMQ can retry the job
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async send(
    to: string,
    subject: string,
    templateName: string,
    context: Record<string, unknown>,
    agencyFrom?: AgencyFrom,
  ): Promise<void> {
    const html = this.renderTemplate(templateName, context);

    // Per-agency sender: "Agency Name <address>" or fall back to platform default
    const from = agencyFrom
      ? agencyFrom.address
        ? `"${agencyFrom.name}" <${agencyFrom.address}>`
        : `"${agencyFrom.name}" <${this.from.includes('<') ? this.from.match(/<(.+)>/)![1] : this.from}>`
      : this.from;

    try {
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`Email sent: ${templateName} → ${to}`);
    } catch (err) {
      // Log but do NOT throw — a failed email should not fail the HTTP request.
      // The invitation record is already created. The admin can resend.
      this.logger.error(`Failed to send email [${templateName}] to ${to}: ${String(err)}`);
    }
  }

  private renderTemplate(name: string, context: Record<string, unknown>): string {
    if (!this.templateCache.has(name)) {
      // In dev/prod: compiled output lands in dist/src/modules/email/
      // Assets (hbs) are copied to dist/modules/email/templates/ (no src prefix).
      // Walk up to dist/ then into modules/email/templates/.
      const templatePath = path.join(__dirname, '..', '..', '..', 'modules', 'email', 'templates', `${name}.hbs`);
      const source = fs.readFileSync(templatePath, 'utf-8');
      this.templateCache.set(name, handlebars.compile(source));
    }
    return this.templateCache.get(name)!(context);
  }
}
