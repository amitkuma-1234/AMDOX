import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/require-role.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * RBAC guard that checks if the authenticated user has any of the required roles.
 * Applied after JWT authentication.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @RequireRole('admin', 'tenant_admin')
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user || !user.roles) {
      this.logger.warn('Access denied: no user or roles in request');
      throw new ForbiddenException('Insufficient permissions');
    }

    // super_admin bypasses all role checks
    if (user.roles.includes('super_admin')) {
      return true;
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `Access denied for user ${user.id}: required roles [${requiredRoles.join(', ')}], ` +
          `user has [${user.roles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
