import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Attribute-Based Access Control (ABAC) Guard.
 * Ensures users can only access their own tenant's data.
 */
@Injectable()
export class AbacGuard implements CanActivate {
  private readonly logger = new Logger(AbacGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true; // Let auth guard handle unauthenticated

    // Extract tenant from request (query, params, or body)
    const requestTenantId =
      request.params?.tenantId ||
      request.query?.tenantId ||
      request.body?.tenantId;

    if (requestTenantId && user.tenantId && requestTenantId !== user.tenantId) {
      this.logger.warn(
        `ABAC violation: User ${user.sub} (tenant ${user.tenantId}) ` +
        `attempted to access tenant ${requestTenantId}`
      );
      throw new ForbiddenException('Access denied: cross-tenant access is not permitted');
    }

    return true;
  }
}
