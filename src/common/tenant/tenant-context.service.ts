import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface TenantStore {
  tenantId: string;
}

/**
 * Holds the current tenant ID for the duration of a request (or background job).
 *
 * Uses Node's AsyncLocalStorage — context propagates automatically through
 * async/await chains, Prisma queries, BullMQ workers, etc.
 * No need to pass tenantId through every function call.
 *
 * Usage:
 *   - Set by TenantMiddleware on every incoming request (from JWT payload)
 *   - Read anywhere: tenantContextService.getTenantId()
 *   - Prisma hook reads it to set SET app.current_tenant for RLS (Phase 1.3)
 */
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  run<T>(tenantId: string, fn: () => T): T {
    return this.storage.run({ tenantId }, fn);
  }

  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  /**
   * Returns tenantId or throws — use inside request handlers where
   * tenant context is guaranteed to exist.
   */
  getRequiredTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error(
        'TenantContext: no tenant ID in current context. ' +
          'Ensure TenantMiddleware is applied to this route.',
      );
    }
    return tenantId;
  }
}
