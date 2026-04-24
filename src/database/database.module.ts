import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SystemPrismaService } from './system-prisma.service';

/**
 * TenantModule is @Global — TenantContextService is available for injection
 * without importing TenantModule here. NestJS resolves it from the global scope.
 * AppModule imports both DatabaseModule and TenantModule, ensuring correct load order.
 *
 * SystemPrismaService is also global — only AuthService should use it.
 * All feature modules must use PrismaService (RLS enforced).
 */
@Global()
@Module({
  providers: [PrismaService, SystemPrismaService],
  exports: [PrismaService, SystemPrismaService],
})
export class DatabaseModule {}
