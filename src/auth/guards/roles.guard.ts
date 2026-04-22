import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators';

/**
 * RolesGuard enforces Role-Based Access Control (RBAC).
 * Checks if the authenticated user has at least one of the required roles.
 *
 * Usage with @RequireRole() decorator:
 *   @UseGuards(AuthGuard('jwt'), RolesGuard)
 *   @RequireRole('admin', 'tenant_admin')
 *   @Get('admin-data')
 *   getAdminData() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('RolesGuard: No user found in request');
      throw new ForbiddenException('Authentication required');
    }

    const userRoles: string[] = user.roles || [];

    // Super admin bypasses all role checks
    if (userRoles.includes('super_admin')) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `Access denied: user ${user.sub || user.id} with roles [${userRoles.join(', ')}] ` +
          `does not have required roles [${requiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
