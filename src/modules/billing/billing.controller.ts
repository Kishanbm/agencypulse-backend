import {
  Controller, Post, Get, Body, Req, Headers, HttpCode, HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { BillingLimitsService } from './billing-limits.service';
import { BillingWebhookService } from './billing-webhook.service';
import { CreateCheckoutDto } from './dto/checkout-session.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly limitsService: BillingLimitsService,
    private readonly webhookService: BillingWebhookService,
  ) {}

  @Post('checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe Checkout session for subscribing (owner only)' })
  createCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckoutSession(user, dto.plan);
  }

  @Post('portal')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session (owner only)' })
  createPortal(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.createPortalSession(user);
  }

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current plan, subscription status, and usage' })
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.limitsService.getUsage(user.tenantId);
  }

  /**
   * Stripe webhook receiver.
   * Raw body required for signature verification (wired via main.ts express.raw middleware).
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1000, ttl: 60_000 } }) // Stripe retries aggressively
  @ApiExcludeEndpoint()
  async webhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) throw new BadRequestException('Missing stripe-signature header.');
    // req.body is Buffer when the raw middleware is applied at main.ts
    const rawBody = (req as Request & { body: Buffer }).body;
    if (!Buffer.isBuffer(rawBody)) {
      throw new BadRequestException('Webhook body was not delivered as raw Buffer.');
    }
    await this.webhookService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
