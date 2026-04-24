import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

// UUID v4 regex — tenantId must match this before being interpolated into SQL
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    config: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {
    super({
      log:
        config.get<string>('app.nodeEnv') === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });

    this.registerTenantHook();
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // ─── RLS Tenant Hook ──────────────────────────────────────────────────────
  //
  // Before every Prisma model operation, SET the session-level GUC
  // `app.current_tenant` so RLS policies can filter rows to the current tenant.
  // After the query (success or failure), RESET the variable to prevent
  // leaking to the next request on the same pooled connection.
  //
  // Why session-level SET (not SET LOCAL)?
  //   SET LOCAL requires an active transaction. Wrapping every query in a
  //   Prisma $transaction to enable SET LOCAL causes connection pool deadlocks
  //   because the transaction hold on one connection while waiting for another.
  //   Session-level SET is safe here because we always RESET in the finally
  //   block — connections are clean before being returned to the pool.
  //
  // Safety guarantee:
  //   The RESET in the finally block runs even if the query throws. The only
  //   leakage scenario is a process crash mid-query, but connection pools
  //   detect dead connections and re-establish them clean.
  //
  private registerTenantHook(): void {
    this.$use(async (params, next) => {
      // Skip raw queries to avoid recursion (SET/RESET themselves use executeRaw)
      if (
        params.action === 'executeRaw' ||
        params.action === 'queryRaw' ||
        params.action === 'runCommandRaw'
      ) {
        return next(params);
      }

      const tenantId = this.tenantContext.getTenantId();

      if (tenantId) {
        if (!UUID_REGEX.test(tenantId)) {
          this.logger.error(
            `Invalid tenantId format in context: "${tenantId}" — query blocked`,
          );
          throw new Error('Invalid tenant context: malformed tenantId');
        }

        // SET session-level GUC so RLS policies see it for the next query
        await this.$executeRawUnsafe(
          `SET app.current_tenant = '${tenantId}'`,
        );

        try {
          return await next(params);
        } finally {
          // Always reset — keeps connection clean for the next requester
          await this.$executeRawUnsafe(`RESET app.current_tenant`);
        }
      }

      // No tenant context (public routes: login, register, health, etc.)
      return next(params);
    });
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        this.logger.error(
          `Database connection failed after ${MAX_RETRIES} attempts. Shutting down.`,
        );
        throw error;
      }

      this.logger.warn(
        `Database not ready (attempt ${attempt}/${MAX_RETRIES}). ` +
          `Retrying in ${(RETRY_DELAY_MS * attempt) / 1000}s...`,
      );

      await this.sleep(RETRY_DELAY_MS * attempt);
      return this.connectWithRetry(attempt + 1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
