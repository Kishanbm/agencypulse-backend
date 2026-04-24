import {
  Injectable, NotFoundException, ForbiddenException, Logger, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require('stripe');
type Stripe = any;
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CheckoutPlan } from './dto/checkout-session.dto';

/**
 * Stripe integration — creates checkout sessions and customer portal sessions.
 *
 * Webhook handling lives in BillingWebhookService.
 * Plan limit enforcement lives in BillingLimitsService.
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;
  private readonly priceIds: { agency?: string; agencyPro?: string };
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set — billing endpoints will fail until configured.');
    }
    // Use latest pinned API version
    this.stripe = new (Stripe as any)(secretKey ?? 'sk_test_noop', { apiVersion: '2024-11-20.acacia' });

    this.priceIds = {
      agency: this.config.get<string>('STRIPE_PRICE_ID_AGENCY'),
      agencyPro: this.config.get<string>('STRIPE_PRICE_ID_AGENCY_PRO'),
    };
    this.frontendUrl =
      this.config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
  }

  // Exposed for webhook service
  getStripe(): Stripe {
    return this.stripe;
  }

  getPriceIds() {
    return this.priceIds;
  }

  // ─── Checkout ───────────────────────────────────────────────────────────────

  async createCheckoutSession(
    user: AuthenticatedUser,
    plan: CheckoutPlan,
  ): Promise<{ checkoutUrl: string }> {
    this.assertOwner(user);

    const agency = await (this.prisma as any).agency.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        stripeCustomerId: true,
      },
    });
    if (!agency) throw new NotFoundException('Agency not found.');

    const priceId =
      plan === CheckoutPlan.AGENCY ? this.priceIds.agency : this.priceIds.agencyPro;
    if (!priceId) {
      throw new BadRequestException(`Stripe price ID for plan ${plan} is not configured.`);
    }

    // Create Stripe customer if missing
    let customerId = agency.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: agency.name,
        metadata: { tenantId: user.tenantId, agencyId: agency.id },
      });
      customerId = customer.id;
      await (this.prisma as any).agency.update({
        where: { id: user.tenantId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/billing/cancel`,
      subscription_data: {
        metadata: { tenantId: user.tenantId },
      },
      metadata: { tenantId: user.tenantId, plan },
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a checkout URL.');
    }
    return { checkoutUrl: session.url };
  }

  // ─── Customer portal (manage subscription, payment methods, invoices) ───────

  async createPortalSession(user: AuthenticatedUser): Promise<{ portalUrl: string }> {
    this.assertOwner(user);

    const agency = await (this.prisma as any).agency.findUnique({
      where: { id: user.tenantId },
      select: { stripeCustomerId: true },
    });
    if (!agency?.stripeCustomerId) {
      throw new BadRequestException(
        'No active subscription. Create a checkout session first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: agency.stripeCustomerId,
      return_url: `${this.frontendUrl}/settings/billing`,
    });
    return { portalUrl: session.url };
  }

  // ─── Role guards ────────────────────────────────────────────────────────────

  private assertOwner(user: AuthenticatedUser) {
    if (user.role !== UserRole.AGENCY_OWNER) {
      throw new ForbiddenException('Only the agency owner can manage billing.');
    }
  }
}
