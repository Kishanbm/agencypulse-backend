import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationPlatform, UserRole, Prisma } from '@prisma/client';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { IntegrationsService } from '../integrations.service';
import { OAuthStateService } from '../oauth-state/oauth-state.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import {
  OAUTH_PLATFORM_CONFIGS,
  OAuthPlatformConfig,
} from './platform-oauth-configs.constants';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

/**
 * Generic OAuth 2.0 authorization-code service for all unimplemented platforms.
 *
 * Handles the full auth flow for 27 platforms via a single service.
 * Platform-specific behavior is driven entirely by OAUTH_PLATFORM_CONFIGS:
 *
 *   Standard flow  — POST body credentials, no PKCE (most platforms)
 *   Basic auth     — Reddit, Pinterest, X/Twitter require Basic auth header
 *   PKCE (S256)    — X/Twitter require code_verifier/challenge; verifier stored
 *                    in signed state JWT so it survives the redirect round-trip
 *   BigCommerce    — forwarding `context` param received in callback
 *   Mailchimp      — post-exchange metadata fetch to get server `dc` prefix
 *   Per-shop       — Shopify/BigCommerce use shop-domain-based URLs
 *
 * As soon as credentials are in .env the full flow works end-to-end.
 * No per-platform code is needed until a dedicated sync method is written.
 */
@Injectable()
export class StandardOAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly integrationsService: IntegrationsService,
    private readonly oauthState: OAuthStateService,
  ) {}

  // ─── Generate auth URL ────────────────────────────────────────────────────

  async generateAuthUrl(
    platform: IntegrationPlatform,
    user: AuthenticatedUser,
    campaignId: string,
    shopDomain?: string,
  ): Promise<{ authUrl: string }> {
    const cfg = this.getPlatformConfig(platform);
    this.assertConfigured(cfg);

    if (cfg.requiresShopDomain && !shopDomain) {
      throw new BadRequestException(
        `shopDomain query parameter is required for ${platform}. ` +
        `Pass ?shopDomain=your-store.myshopify.com`,
      );
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: this.buildCampaignWhere(user, campaignId),
      select: { id: true, clientId: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found.');

    // PKCE: generate verifier + challenge, store verifier in state JWT
    let pkceVerifier: string | undefined;
    let pkceChallenge: string | undefined;
    if (cfg.usesPKCE) {
      pkceVerifier = this.generateCodeVerifier();
      pkceChallenge = this.generateCodeChallenge(pkceVerifier);
    }

    const state = this.oauthState.signState({
      campaignId,
      clientId: campaign.clientId,
      tenantId: user.tenantId,
      userId: user.id,
      platform,
      ...(pkceVerifier ? { pkceVerifier } : {}),
    });

    const clientId = this.config.get<string>(cfg.clientIdKey)!;
    const redirectUri = this.config.get<string>(cfg.redirectUriKey)!;

    const authBase = cfg.requiresShopDomain && cfg.shopAuthTemplate
      ? cfg.shopAuthTemplate.replace('{shop}', shopDomain!)
      : cfg.authEndpoint;

    const sep = cfg.scopeSeparator ?? ' ';
    const scopeStr = cfg.scopes
      ? cfg.scopes.split(',').map((s) => s.trim()).join(sep)
      : undefined;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      ...(scopeStr ? { scope: scopeStr } : {}),
      ...(cfg.extraAuthParams ?? {}),
      ...(cfg.usesPKCE
        ? { code_challenge: pkceChallenge!, code_challenge_method: 'S256' }
        : {}),
    });

    // X (Twitter) OAuth 2.0 rejects scope encoded with `+` (URLSearchParams default).
    // Replace `+` → `%20` in scope only so X accepts the space-separated scope list.
    const authUrl = `${authBase}?${params.toString().replace(/(?<=(?:^|&)scope=)[^&]+/, s => s.replace(/\+/g, '%20'))}`;
    return { authUrl };
  }

  // ─── Handle OAuth callback ─────────────────────────────────────────────────
  // Public endpoint — no JWT context.
  // TenantContextService.run() sets RLS tenant context for all DB operations.

  async handleCallback(
    platform: IntegrationPlatform,
    rawCode: string | undefined,
    rawAuthCode: string | undefined,
    rawState: string,
    options?: { shopDomain?: string; context?: string },
  ): Promise<string> {
    const cfg = this.getPlatformConfig(platform);
    this.assertConfigured(cfg);

    const code = cfg.usesAuthCodeField ? rawAuthCode : rawCode;
    if (!code) {
      throw new BadRequestException('Authorization code missing from OAuth callback.');
    }

    const state = this.oauthState.verifyState(rawState);
    if (state.platform !== platform) {
      throw new BadRequestException(
        `OAuth state platform mismatch: expected ${platform}, got ${state.platform}.`,
      );
    }

    const tokens = await this.exchangeCode(cfg, code, {
      pkceVerifier: state.pkceVerifier,
      shopDomain: options?.shopDomain,
      context: options?.context,
    });

    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : cfg.tokenTtlMs
        ? new Date(Date.now() + cfg.tokenTtlMs)
        : undefined;

    // Mailchimp: fetch dc server prefix, store as externalAccountId
    let externalAccountId: string | undefined;
    if (cfg.requiresMetadataFetch) {
      externalAccountId = await this.fetchMailchimpMetadata(tokens.access_token);
    }

    await this.tenantContext.run(state.tenantId, async () => {
      const campaign = await this.prisma.campaign.findFirst({
        where: {
          id: state.campaignId,
          tenantId: state.tenantId,
          deletedAt: null,
          client: { deletedAt: null },
        },
        select: { id: true },
      });
      if (!campaign) {
        throw new BadRequestException(
          'The campaign is no longer available. The connection could not be saved.',
        );
      }

      await this.integrationsService.storeTokens(
        state.tenantId,
        campaign.id,
        platform,
        {
          accessToken: tokens.access_token,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          ...(tokenExpiresAt ? { tokenExpiresAt } : {}),
          ...(tokens.scope ? { scopes: tokens.scope } : {}),
          ...(externalAccountId ? { externalAccountId } : {}),
        },
      );
    });

    const platformSlug = platform.toLowerCase().replace(/_/g, '-');
    const frontendUrl = this.config.get<string>('app.frontendUrl');
    return `${frontendUrl}/clients/${state.clientId}/campaigns/${state.campaignId}/integrations?connected=${platformSlug}`;
  }

  // ─── Private: code exchange ────────────────────────────────────────────────

  private async exchangeCode(
    cfg: OAuthPlatformConfig,
    code: string,
    opts: { pkceVerifier?: string; shopDomain?: string; context?: string },
  ): Promise<TokenResponse> {
    const clientId = this.config.get<string>(cfg.clientIdKey)!;
    const clientSecret = this.config.get<string>(cfg.clientSecretKey)!;
    const redirectUri = this.config.get<string>(cfg.redirectUriKey)!;

    const tokenEndpoint = cfg.requiresShopDomain && cfg.shopTokenTemplate
      ? cfg.shopTokenTemplate.replace('{shop}', opts.shopDomain!)
      : cfg.tokenEndpoint;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (cfg.useBasicAuth) {
      // Reddit, Pinterest, X/Twitter: credentials via Basic auth header
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else {
      // Standard: credentials in body
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);
    }

    // PKCE: include code_verifier in token exchange body
    if (cfg.usesPKCE && opts.pkceVerifier) {
      body.append('code_verifier', opts.pkceVerifier);
    }

    // BigCommerce: forward `context` param received in callback
    if (cfg.requiresContextParam && opts.context) {
      body.append('context', opts.context);
    }

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BadRequestException(
        `Token exchange failed for ${cfg.platform} (HTTP ${response.status}). ` +
        text.slice(0, 300),
      );
    }

    return response.json() as Promise<TokenResponse>;
  }

  // ─── Private: Mailchimp metadata fetch ────────────────────────────────────
  // Returns the server prefix `dc` (e.g. "us1") needed to build API base URLs.

  private async fetchMailchimpMetadata(accessToken: string): Promise<string> {
    const response = await fetch('https://login.mailchimp.com/oauth2/metadata', {
      headers: { Authorization: `OAuth ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Mailchimp metadata fetch failed (HTTP ${response.status}). ` +
        `Cannot determine API server — please reconnect.`,
      );
    }

    const data = await response.json() as { dc?: string };
    if (!data.dc) {
      throw new BadRequestException(
        'Mailchimp metadata response did not include a server prefix (dc). ' +
        'Please reconnect.',
      );
    }

    return data.dc;
  }

  // ─── Private: PKCE helpers ─────────────────────────────────────────────────

  private generateCodeVerifier(): string {
    // 32 random bytes → 43 URL-safe base64 characters (within the 43–128 range)
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }

  // ─── Private: config lookup ────────────────────────────────────────────────

  private getPlatformConfig(platform: IntegrationPlatform): OAuthPlatformConfig {
    const cfg = OAUTH_PLATFORM_CONFIGS.get(platform);
    if (!cfg) {
      throw new ServiceUnavailableException(
        `No OAuth config registered for platform: ${platform}. ` +
        `This is a backend configuration error.`,
      );
    }
    return cfg;
  }

  private assertConfigured(cfg: OAuthPlatformConfig): void {
    const missing: string[] = [];
    if (!this.config.get(cfg.clientIdKey)) missing.push(cfg.clientIdKey);
    if (!this.config.get(cfg.clientSecretKey)) missing.push(cfg.clientSecretKey);
    if (!this.config.get(cfg.redirectUriKey)) missing.push(cfg.redirectUriKey);

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `${cfg.platform} integration is not configured. ` +
        `Set these environment variables: ${missing.join(', ')}`,
      );
    }
  }

  // ─── Private: campaign where clause (role-aware) ──────────────────────────

  buildCampaignWhere(
    user: AuthenticatedUser,
    campaignId: string,
  ): Prisma.CampaignWhereInput {
    const base: Prisma.CampaignWhereInput = {
      id: campaignId,
      tenantId: user.tenantId,
      deletedAt: null,
      client: { deletedAt: null },
    };
    const role = user.role as UserRole;

    if (
      role === UserRole.PLATFORM_OWNER ||
      role === UserRole.AGENCY_OWNER ||
      role === UserRole.AGENCY_ADMIN
    ) {
      return base;
    }
    if (role === UserRole.AGENCY_STAFF) {
      return {
        ...base,
        client: { is: { deletedAt: null, staffAssignments: { some: { userId: user.id } } } },
      };
    }
    return { ...base, id: 'no-access' };
  }
}
