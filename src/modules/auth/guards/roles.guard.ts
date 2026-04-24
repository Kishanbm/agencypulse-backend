import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

// ─── Role Hierarchy ──────────────────────────────────────────────────────────
//
// Higher index = more privilege.
// A user can access any route that requires a role at their level OR below.
//
// Examples:
//   AGENCY_ADMIN (level 2) can access routes requiring AGENCY_ADMIN, AGENCY_STAFF, CLIENT_USER
//   AGENCY_STAFF (level 1) CANNOT access routes requiring AGENCY_ADMIN
//   PLATFORM_OWNER (level 4) can access everything
//
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.CLIENT_USER,    // 0 — read-only portal
  UserRole.AGENCY_STAFF,   // 1 — assigned clients only (filtered at service layer)
  UserRole.AGENCY_ADMIN,   // 2 — full agency access
  UserRole.AGENCY_OWNER,   // 3 — billing owner, cannot be removed
  UserRole.PLATFORM_OWNER, // 4 — AgencyPulse operators
];

function getRoleLevel(role: UserRole): number {
  const level = ROLE_HIERARCHY.indexOf(role);
  return level === -1 ? -1 : level; // unknown role = lowest privilege
}

/**
 * RolesGuard — enforces ROLE-BASED access control at the endpoint level.
 *
 * ─── Scope of responsibility ──────────────────────────────────────────────
 * This guard ONLY answers: "Can a user with this ROLE TYPE access this endpoint?"
 *
 * It does NOT answer:
 *   - "Can this staff member access this specific client?" → service layer
 *   - "Can this client user see this specific campaign?" → service layer
 *   - "Does this user own this resource?" → service layer
 *
 * Mixing resource-level filtering into guards creates tight coupling,
 * makes guards impossible to reuse, and puts DB queries in the wrong layer.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Must run AFTER JwtAuthGuard (which populates req.user).
 * When registered globally alongside JwtAuthGuard, all routes are protected.
 * Routes with no @Roles() allow any authenticated user.
 * Routes with @Public() bypass both guards entirely.
 *
 * Usage on a specific route:
 *   @Roles(UserRole.AGENCY_ADMIN)
 *   async createClient() {}
 *
 * Usage to restrict to a single role and above:
 *   @Roles(UserRole.AGENCY_OWNER)
 *   async transferOwnership() {}
 *
 * Usage to allow multiple specific roles (OR logic):
 *   @Roles(UserRole.AGENCY_STAFF, UserRole.CLIENT_USER)
 *   async viewDashboard() {}   // staff OR client (and anything above staff)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() decorator — any authenticated user can proceed
    // (JWT authentication already enforced by JwtAuthGuard)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    // Guard against missing user — should never happen if JwtAuthGuard runs first
    if (!user) {
      throw new ForbiddenException('No authenticated user in request context');
    }

    const userLevel = getRoleLevel(user.role as UserRole);

    // When multiple roles are declared, the user must satisfy the
    // LOWEST declared level (OR logic with hierarchy).
    // Example: @Roles(AGENCY_ADMIN, AGENCY_STAFF) → minimum is AGENCY_STAFF (level 1)
    // An AGENCY_ADMIN (level 2) passes because 2 >= 1.
    const minimumRequiredLevel = Math.min(
      ...requiredRoles.map((r) => getRoleLevel(r)),
    );

    if (userLevel < minimumRequiredLevel) {
      throw new ForbiddenException(
        `Access denied. Required: ${requiredRoles.join(' or ')}. Your role: ${user.role}`,
      );
    }

    return true;
  }
}
