import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

/**
 * TenantIsolationGuard ensures that all requests are properly
 * scoped to a tenant. Prevents cross-tenant data access.
 *
 * This guard should be applied globally or on all tenant-scoped routes.
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  private readonly logger = new Logger(TenantIsolationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
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

    return true;
  }
}
