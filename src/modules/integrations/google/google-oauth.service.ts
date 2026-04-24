import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthStateService, OAuthStatePayload } from '../oauth-state/oauth-state.service';

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string; // Only returned on first consent; absent on re-auth
  expires_in: number;
  token_type: string;
  scope?: string;
}

/**
 * Shared OAuth utilities for all Google integrations (GA4, Google Ads, Search Console, etc.).
 *
 * Handles:
 *   - State JWT sign / verify — delegated to OAuthStateService (platform-agnostic)
 *   - Authorization code exchange for tokens (Google token endpoint)
 *   - Access token refresh (Google token endpoint)
 *
 * Fix (AI review): Sign/verify extracted to OAuthStateService so Meta and future
 * non-Google platforms are not coupled to GoogleOAuthService.
 *
 * Security: GOOGLE_CLIENT_SECRET is read at call time — never logged, never
 * returned in any HTTP response.
 */
@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly oauthState: OAuthStateService,
  ) {}

  // ─── State JWT — delegated to OAuthStateService ───────────────────────────

  signState(payload: OAuthStatePayload): string {
    return this.oauthState.signState(payload);
  }

  verifyState(rawState: string): OAuthStatePayload {
    return this.oauthState.verifyState(rawState);
  }

  // ─── Code exchange ─────────────────────────────────────────────────────────

  async exchangeCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
    this.assertCoreConfigured();

    const params = new URLSearchParams({
      code,
      client_id: this.config.get<string>('google.clientId')!,
      client_secret: this.config.get<string>('google.clientSecret')!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to exchange authorization code with Google. Please try again.',
      );
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  // ─── Token refresh ─────────────────────────────────────────────────────────

  async refreshAccessToken(
    refreshToken: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; tokenExpiresAt: Date }> {
    this.assertCoreConfigured();

    const params = new URLSearchParams({
      client_id: this.config.get<string>('google.clientId')!,
      client_secret: this.config.get<string>('google.clientSecret')!,
      refresh_token: refreshToken,
      redirect_uri: redirectUri,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new BadRequestException('Google token refresh failed. Re-connect the integration.');
    }

    const data = (await response.json()) as GoogleTokenResponse;
    return {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  assertCoreConfigured(): void {
    if (
      !this.config.get('google.clientId') ||
      !this.config.get('google.clientSecret')
    ) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      );
    }
  }
}
