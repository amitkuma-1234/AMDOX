import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
<<<<<<< HEAD
import { ROLES_KEY } from '../decorators/require-role.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * RBAC guard that checks if the authenticated user has any of the required roles.
 * Applied after JWT authentication.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @RequireRole('admin', 'tenant_admin')
=======
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
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
<<<<<<< HEAD
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access
=======
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles required, allow access
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
<<<<<<< HEAD
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
=======
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
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
