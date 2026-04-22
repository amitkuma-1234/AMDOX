import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

/**
 * TenantIsolationGuard ensures that all requests are properly scoped to the authenticated user's tenant.
 * It prevents cross-tenant data access by comparing the user's tenant context with the request context.
 *
 * Super-admins can access any tenant.
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  private readonly logger = new Logger(TenantIsolationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const requestTenantId = request.tenantId;

    // Skip tenant check for unauthenticated routes (e.g. Health, Login)
    // These should typically exclude this guard in AppModule.
    if (!user) {
      return true;
    }

    // Super admins bypass isolation checks
    const userRoles: string[] = user.roles || [];
    if (userRoles.includes('super_admin')) {
      return true;
    }

    // Verify user has a tenant assigned in their JWT
    const userTenantId = user.tenantId || user.tenant_id;
    if (!userTenantId) {
      this.logger.warn(`Access denied: User ${user.userId || user.sub} has no tenant context`);
      throw new ForbiddenException('No tenant context available');
    }

    // 1. Check against request context (set by Middleware)
    if (requestTenantId && requestTenantId !== userTenantId) {
      this.logger.error(
        `🚨 TENANT ISOLATION VIOLATION: User ${user.userId || user.sub} ` +
        `(tenant: ${userTenantId}) attempted to access request context for tenant: ${requestTenantId}`,
      );
      throw new ForbiddenException('Cross-tenant access denied');
    }

    // 2. Check against route parameters
    const routeTenantId = request.params?.tenantId;
    if (routeTenantId && routeTenantId !== userTenantId) {
      this.logger.error(
        `🚨 TENANT PARAMETER VIOLATION: User ${user.userId || user.sub} ` +
        `attempted to access route param for tenant: ${routeTenantId}`,
      );
      throw new ForbiddenException('Tenant mismatch in route');
    }

    // 3. Check against body (prevent spoofing)
    if (request.body?.tenantId && request.body.tenantId !== userTenantId) {
      this.logger.warn(
        `🚨 TENANT BODY INJECTION ATTEMPT: User ${user.userId || user.sub} ` +
        `tried to inject tenantId ${request.body.tenantId}. Overriding.`,
      );
      request.body.tenantId = userTenantId;
    }

    return true;
  }
}
