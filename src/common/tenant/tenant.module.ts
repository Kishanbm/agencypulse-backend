import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantContextService } from './tenant-context.service';
import { TenantMiddleware } from './tenant.middleware';
import { HostResolutionService } from './host-resolution.service';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../cache/cache.module';

/**
 * Global module — registers TenantContextService and applies TenantMiddleware
 * to all routes automatically.
 *
 * Marked @Global so TenantContextService can be injected anywhere without
 * importing TenantModule in each feature module.
 *
 * JwtModule is imported here (without secret) so TenantMiddleware can
 * verify the Bearer token to extract tenantId. The secret is read at
 * runtime from ConfigService.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({}), // secret injected via ConfigService in TenantMiddleware
    DatabaseModule,
    CacheModule,
  ],
  providers: [TenantContextService, TenantMiddleware, HostResolutionService],
  exports: [TenantContextService, HostResolutionService],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*'); // Applied to all routes — middleware decides per-request if tenant exists
  }
}
