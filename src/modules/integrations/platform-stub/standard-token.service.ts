import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationPlatform } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { IntegrationsService } from '../integrations.service';
import {
  OAUTH_PLATFORM_CONFIGS,
  OAuthPlatformConfig,
} from './platform-oauth-configs.constants';

/**
 * Generic OAuth token refresh service for all stub platforms.
 *
 * Used by the integration sync processor to obtain a fresh access token
 * before each API call. Covers all 27 OAuth platforms in OAUTH_PLATFORM_CONFIGS.
 *
 * Refresh behaviour per platform type:
 *   hasRefreshToken: true  — standard refresh_token grant; stores rotated tokens
 *   hasRefreshToken: false — token is long-lived (Meta ~60d, Mailchimp permanent,
 *                            Shopify permanent, Vimeo permanent). Returns current
 *                            token if not expired; throws if expired so the processor
 *                            marks EXPIRED and stops retrying.
 *   useBasicAuth: true     — client credentials sent via Authorization: Basic header
 *                            (Pinterest, Reddit, X/Twitter) instead of POST body.
 */
@Injectable()
export class StandardTokenService {
  private readonly logger = new Logger(StandardTokenService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Returns a valid (non-expired) access token for `platform`.
   * Refreshes automatically if the token expires within 5 minutes.
   * Throws if token is expired and cannot be refreshed.
   */
  async getValidAccessToken(
    platform: IntegrationPlatform,
    tenantId: string,
    campaignId: string,
  ): Promise<string> {
    const cfg = this.getPlatformConfig(platform);

    // Load raw connection row so we can decrypt tokens and check expiry
    const row = await this.prisma.integrationConnection.findUnique({
      where: { campaignId_platform: { campaignId, platform } },
      select: {
        accessTokenEnc: true,
        refreshTokenEnc: true,
        tokenExpiresAt: true,
      },
    });

    if (!row?.accessTokenEnc) {
      throw new ServiceUnavailableException(
        `No stored access token for ${platform}. Re-connect the integration.`,
      );
    }

    const accessToken = this.encryption.decrypt(row.accessTokenEnc);
    const refreshToken = row.refreshTokenEnc
      ? this.encryption.decrypt(row.refreshTokenEnc)
      : null;

    // If token expires > 5 min from now, return it as-is
    const FIVE_MIN = 5 * 60 * 1000;
    if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() - Date.now() > FIVE_MIN) {
      return accessToken;
    }

    // Token is expiring or has no expiry recorded
    if (!cfg.hasRefreshToken || !refreshToken) {
      // Platform doesn't support refresh (Meta, Mailchimp, Shopify, Vimeo, etc.)
      // If we have no expiry date, assume it's still valid (Shopify/Mailchimp never expire)
      if (!row.tokenExpiresAt) {
        return accessToken;
      }
      // Token has expired and we can't refresh — caller must mark EXPIRED
      throw new ServiceUnavailableException(
        `${platform} access token has expired and cannot be refreshed automatically. ` +
        `Please reconnect the integration.`,
      );
    }

    // Refresh the access token
    this.logger.log(`[${platform}] Refreshing access token (expires ${row.tokenExpiresAt?.toISOString() ?? 'unknown'})`);
    const refreshed = await this.refreshAccessToken(cfg, refreshToken);

    // Persist new tokens
    await this.integrationsService.storeTokens(tenantId, campaignId, platform, {
      accessToken: refreshed.accessToken,
      ...(refreshed.refreshToken ? { refreshToken: refreshed.refreshToken } : {}),
      ...(refreshed.expiresAt ? { tokenExpiresAt: refreshed.expiresAt } : {}),
    });

    return refreshed.accessToken;
  }

  // ─── Private: token refresh call ─────────────────────────────────────────────

  private async refreshAccessToken(
    cfg: OAuthPlatformConfig,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const clientId = this.config.get<string>(cfg.clientIdKey)!;
    const clientSecret = this.config.get<string>(cfg.clientSecretKey)!;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (cfg.useBasicAuth) {
      // Pinterest, Reddit, X/Twitter: credentials via Basic auth header
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${creds}`;
    } else {
      // Standard: credentials in POST body
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);
    }

    // Some platforms (Microsoft) require redirect_uri in refresh call
    const redirectUri = this.config.get<string>(cfg.redirectUriKey);
    if (redirectUri) {
      body.append('redirect_uri', redirectUri);
    }

    const response = await fetch(cfg.tokenEndpoint, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Token refresh failed for ${cfg.platform} (HTTP ${response.status}): ${text.slice(0, 200)}`,
      );
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      ...(data.expires_in
        ? { expiresAt: new Date(Date.now() + data.expires_in * 1000) }
        : {}),
    };
  }

  // ─── Private: config lookup ───────────────────────────────────────────────────

  private getPlatformConfig(platform: IntegrationPlatform): OAuthPlatformConfig {
    const cfg = OAUTH_PLATFORM_CONFIGS.get(platform);
    if (!cfg) {
      throw new ServiceUnavailableException(
        `No OAuth config registered for ${platform}. ` +
        `This is a backend configuration error.`,
      );
    }
    return cfg;
  }
}
