import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

/**
 * Parameter decorator to inject the current tenant ID directly into a controller method.
 *
 * Usage:
 *   @Get('clients')
 *   getClients(@TenantId() tenantId: string) { ... }
 *
 * Note: For most use cases, inject TenantContextService and call
 * getRequiredTenantId() in the service layer instead of using this decorator.
 * This decorator is a convenience for simple controller-level access.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ tenantContextService?: TenantContextService }>();
    // The tenantId is in AsyncLocalStorage — read it via the service
    // The service is accessed via the request's app context
    const app = (request as unknown as { app?: { get?: (token: unknown) => unknown } }).app;
    if (app?.get) {
      const service = app.get(TenantContextService) as TenantContextService | undefined;
      return service?.getTenantId();
    }
    return undefined;
  },
);
