import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Stripe types accessed as any — default-export interop with CommonJS
type Stripe = any;
type StripeEvent = any;
type StripeSubscription = any;
type StripeInvoice = any;
type StripeCheckoutSession = any;
import { AgencyPlan } from '@prisma/client';
import { SystemPrismaService } from '../../database/system-prisma.service';
import { BillingService } from './billing.service';
import { planFromPriceId } from './constants/plans';

/**
 * Stripe webhook handler.
 *
 * Security:
 *   - Signature verified using STRIPE_WEBHOOK_SECRET
 *   - Idempotent: billing_events.stripe_event_id UNIQUE — replays silently ignored
 *   - Runs under SystemPrismaService (cross-tenant access — webhook has no auth context)
 *
 * Only returns 200 on successfully recorded events, so Stripe will retry on failure.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly systemPrisma: SystemPrismaService,
    private readonly billingService: BillingService,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured.');
    }

    let event: StripeEvent;
    try {
      event = this.billingService.getStripe().webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: unknown) {
      this.logger.warn(`Stripe signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid Stripe signature.');
    }

    // Idempotency: record event first (unique on stripe_event_id)
    try {
      await (this.systemPrisma as any).billingEvent.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          data: event.data.object as any,
        },
      });
    } catch (err: unknown) {
      // Unique constraint → already processed
      const msg = (err as Error).message || '';
      if (msg.includes('Unique') || msg.includes('unique') || msg.includes('P2002')) {
        this.logger.log(`Duplicate Stripe event ${event.id} (${event.type}) — skipping`);
        return;
      }
      throw err;
    }

    // Process event
    try {
      await this.dispatch(event);
      await (this.systemPrisma as any).billingEvent.updateMany({
        where: { stripeEventId: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err: unknown) {
      const errMsg = (err as Error).message;
      this.logger.error(`Webhook processing failed for ${event.type}: ${errMsg}`);
      await (this.systemPrisma as any).billingEvent.updateMany({
        where: { stripeEventId: event.id },
        data: { error: errMsg },
      });
      throw err;
    }
  }

  // ─── Event dispatcher ───────────────────────────────────────────────────────

  private async dispatch(event: StripeEvent): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        return this.onCheckoutCompleted(event.data.object as StripeCheckoutSession);

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        return this.onSubscriptionChanged(event.data.object as StripeSubscription);

      case 'customer.subscription.deleted':
        return this.onSubscriptionDeleted(event.data.object as StripeSubscription);

      case 'invoice.payment_failed':
        return this.onPaymentFailed(event.data.object as StripeInvoice);

      case 'invoice.payment_succeeded':
        return this.onPaymentSucceeded(event.data.object as StripeInvoice);

      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async onCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
    const tenantId = (session.metadata?.tenantId as string) || null;
    if (!tenantId) return;

    await (this.systemPrisma as any).agency.update({
      where: { id: tenantId },
      data: {
        stripeCustomerId: session.customer as string,
      },
    });

    // Link the billing_event to the tenant retroactively
    await (this.systemPrisma as any).billingEvent.updateMany({
      where: { stripeEventId: session.id ?? undefined },
      data: { tenantId },
    });
  }

  private async onSubscriptionChanged(sub: StripeSubscription): Promise<void> {
    const tenantId = (sub.metadata?.tenantId as string) || null;
    const customerId = sub.customer as string;

    const agency = tenantId
      ? await (this.systemPrisma as any).agency.findUnique({ where: { id: tenantId } })
      : await (this.systemPrisma as any).agency.findFirst({ where: { stripeCustomerId: customerId } });

    if (!agency) {
      this.logger.warn(`Subscription webhook for unknown customer ${customerId}`);
      return;
    }

    const priceId = sub.items.data[0]?.price.id;
    const plan = priceId
      ? planFromPriceId(priceId, this.billingService.getPriceIds())
      : AgencyPlan.FREELANCER;

    await (this.systemPrisma as any).agency.update({
      where: { id: agency.id },
      data: {
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        subscriptionStatus: sub.status,
        subscriptionPeriodEnd: new Date((sub as any).current_period_end * 1000),
        plan,
      },
    });
  }

  private async onSubscriptionDeleted(sub: StripeSubscription): Promise<void> {
    const agency = await (this.systemPrisma as any).agency.findFirst({
      where: { stripeSubscriptionId: sub.id },
    });
    if (!agency) return;

    await (this.systemPrisma as any).agency.update({
      where: { id: agency.id },
      data: {
        plan: AgencyPlan.FREELANCER,
        subscriptionStatus: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
      },
    });
  }

  private async onPaymentFailed(invoice: StripeInvoice): Promise<void> {
    const customerId = invoice.customer as string;
    const agency = await (this.systemPrisma as any).agency.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!agency) return;
    await (this.systemPrisma as any).agency.update({
      where: { id: agency.id },
      data: { subscriptionStatus: 'past_due' },
    });
    this.logger.warn(`Payment failed for agency ${agency.id} — marked past_due`);
  }

  private async onPaymentSucceeded(invoice: StripeInvoice): Promise<void> {
    const customerId = invoice.customer as string;
    const agency = await (this.systemPrisma as any).agency.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!agency) return;
    if (agency.subscriptionStatus === 'past_due') {
      await (this.systemPrisma as any).agency.update({
        where: { id: agency.id },
        data: { subscriptionStatus: 'active' },
      });
    }
  }
}
