import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TokenService } from './token.service';

/**
 * AuthCleanupTask — daily maintenance job for the refresh_tokens table.
 *
 * Without cleanup, the table grows indefinitely because:
 *   - Every login creates one row
 *   - Every refresh rotation creates one row (old one gets revokedAt set)
 *   - Expired tokens are never automatically removed
 *
 * Retention policy:
 *   - Expired (not yet revoked) tokens: deleted immediately
 *   - Revoked tokens: kept for 30 days as theft-detection audit trail,
 *     then deleted
 *
 * Runs at 3:00 AM every day (server time) — low-traffic window.
 */
@Injectable()
export class AuthCleanupTask {
  private readonly logger = new Logger(AuthCleanupTask.name);

  constructor(private readonly tokenService: TokenService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    this.logger.log('Running refresh token cleanup...');

    try {
      const deleted = await this.tokenService.deleteExpiredTokens();
      this.logger.log(`Refresh token cleanup complete — ${deleted} rows deleted`);
    } catch (err) {
      this.logger.error('Refresh token cleanup failed', err);
    }
  }
}
