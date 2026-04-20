import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
<<<<<<< HEAD
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
=======

/**
 * TenantIsolationGuard ensures that all requests are properly
 * scoped to a tenant. Prevents cross-tenant data access.
 *
 * This guard should be applied globally or on all tenant-scoped routes.
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  private readonly logger = new Logger(TenantIsolationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
<<<<<<< HEAD
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
=======
    const user = request.user;
    const tenantId = request.tenantId;

    // Skip tenant check for unauthenticated routes (health checks, etc.)
    if (!user) {
      return true;
    }

    // Ensure tenantId is present in request context
    if (!tenantId) {
      this.logger.warn(
        `Tenant isolation violation: no tenantId in request for user ${user.sub || user.id}`,
      );
      throw new ForbiddenException('Tenant context is required');
    }

    // Super admin can access any tenant
    const userRoles: string[] = user.roles || [];
    if (userRoles.includes('super_admin')) {
      return true;
    }

    // Verify user belongs to the requested tenant
    const userTenantId = user.tenant_id || user.tenantId;
    if (userTenantId && userTenantId !== tenantId) {
      this.logger.error(
        `🚨 TENANT ISOLATION VIOLATION: User ${user.sub || user.id} ` +
        `(tenant: ${userTenantId}) attempted to access tenant: ${tenantId}`,
      );
      throw new ForbiddenException('Cross-tenant access denied');
    }

    // Ensure request body doesn't contain a different tenantId
    if (request.body?.tenantId && request.body.tenantId !== tenantId) {
      this.logger.error(
        `🚨 TENANT INJECTION ATTEMPT: User ${user.sub || user.id} ` +
        `tried to inject tenantId ${request.body.tenantId} (actual: ${tenantId})`,
      );
      // Override with correct tenantId
      request.body.tenantId = tenantId;
    }
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b

    return true;
  }
}
