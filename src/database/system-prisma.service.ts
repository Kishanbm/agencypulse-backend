import { Injectable, OnModuleInit, OnApplicationShutdown, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * SystemPrismaService — connects as the agencypulse table owner role.
 *
 * Why this exists:
 *   The regular PrismaService connects as `agencypulse_app` — a low-privilege
 *   role subject to Row Level Security (RLS). This is the correct setup for all
 *   tenant-scoped operations (every query is filtered to the current tenant).
 *
 *   However, public auth operations (register, login, storeRefreshToken) run
 *   BEFORE a tenant context exists. These operations need to:
 *     - INSERT into agencies/users/refresh_tokens without a tenant context
 *     - SELECT users by email globally (for login — tenant unknown at that point)
 *
 *   The table owner (`agencypulse`) bypasses RLS unconditionally, making it
 *   safe for these bootstrap operations.
 *
 * Security contract:
 *   - ONLY used from AuthService for register/login/storeRefreshToken
 *   - Never injected into feature modules (clients, campaigns, etc.)
 *   - All business data access goes through PrismaService (RLS enforced)
 */
@Injectable()
export class SystemPrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(SystemPrismaService.name);

  constructor(config: ConfigService) {
    const migrationUrl = config.get<string>('database.migrationUrl');

    super({
      datasources: {
        db: { url: migrationUrl },
      },
      log:
        config.get<string>('app.nodeEnv') === 'development'
          ? ['warn', 'error']  // Less verbose than the main service — auth ops are high-frequency
          : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('System database connection established');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
