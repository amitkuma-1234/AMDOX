import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Tenant isolation guard.
 * Ensures that the authenticated user can only access resources
 * belonging to their own tenant.
 *
 * Checks:
 * 1. User has a tenantId in their JWT
 * 2. Request tenantId matches the user's tenantId
 * 3. Route params :tenantId (if present) matches
 *
 * Super admins can access any tenant.
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  private readonly logger = new Logger(TenantIsolationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admins can access any tenant
    if (user.roles?.includes('super_admin')) {
      return true;
    }

    // Verify user has a tenant assigned
    if (!user.tenantId) {
      this.logger.warn(`User ${user.id} has no tenant assigned`);
      throw new ForbiddenException('No tenant context available');
    }

    // Check if route has a tenantId parameter
    const routeTenantId = request.params?.tenantId;
    if (routeTenantId && routeTenantId !== user.tenantId) {
      this.logger.warn(
        `Tenant isolation violation: user ${user.id} (tenant ${user.tenantId}) ` +
          `attempted to access tenant ${routeTenantId}`,
      );
      throw new ForbiddenException('Access denied: tenant mismatch');
    }

    // Inject tenantId into request for downstream use
    request.tenantId = user.tenantId;

    return true;
  }
}
