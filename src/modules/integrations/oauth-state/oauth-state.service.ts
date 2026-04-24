import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { IntegrationPlatform } from '@prisma/client';

// Payload encoded in every OAuth state JWT — platform-agnostic.
// platform is included so each callback can verify the flow it initiated.
export interface OAuthStatePayload {
  campaignId: string;
  tenantId: string;
  userId: string;
  platform: IntegrationPlatform;
}

/**
 * Platform-agnostic OAuth state JWT utilities.
 *
 * Used by ALL integration OAuth flows (Google GA4, Google Ads, Meta Ads,
 * and future platforms) to sign and verify the state parameter.
 *
 * Why extracted: Google and Meta use completely different token endpoints
 * but both need the same CSRF-protection state JWT. Keeping this logic
 * here ensures one implementation and one security review for state handling.
 *
 * Signs with JWT_ACCESS_SECRET — same key as access tokens, short TTL (10m).
 */
@Injectable()
export class OAuthStateService {
  constructor(private readonly config: ConfigService) {}

  signState(payload: OAuthStatePayload): string {
    const secret = this.config.get<string>('jwt.accessSecret')!;
    return (jwt as any).sign(payload, secret, { expiresIn: '10m' });
  }

  verifyState(rawState: string): OAuthStatePayload {
    const secret = this.config.get<string>('jwt.accessSecret')!;
    try {
      return (jwt as any).verify(rawState, secret) as OAuthStatePayload;
    } catch {
      throw new BadRequestException(
        'Invalid or expired OAuth state. Please start the connection flow again.',
      );
    }
  }
}
