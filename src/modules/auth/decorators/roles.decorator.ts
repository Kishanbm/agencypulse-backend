import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles) — declares the minimum role(s) required to access a route.
 *
 * RolesGuard enforces the hierarchy: a higher-level role always satisfies
 * a lower-level requirement. Declaring multiple roles means ANY of them
 * (or higher) is sufficient.
 *
 * Usage:
 *   @Roles(UserRole.AGENCY_ADMIN)
 *   async createClient() {}   // AGENCY_ADMIN, AGENCY_OWNER, PLATFORM_OWNER can access
 *
 *   @Roles(UserRole.AGENCY_STAFF)
 *   async listAssignedClients() {}   // all roles except CLIENT_USER can access
 *
 * NOTE: RolesGuard only controls ENDPOINT ACCESS by role type.
 * Resource-level filtering (e.g. "staff can only see assigned clients") is
 * enforced separately in the service layer — NOT here.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
