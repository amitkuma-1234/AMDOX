import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
<<<<<<< HEAD
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Attribute-Based Access Control (ABAC) guard.
 * Evaluates fine-grained permissions from the @RequirePermission() decorator.
 *
 * Permission format: "resource:action"
 * Examples: "accounts:read", "accounts:write", "journal:post", "employees:delete"
 *
 * Supports wildcard: "accounts:*" grants all actions on accounts.
 *
 * Permissions are stored in the Role.permissions JSON array and flattened
 * into the JWT token by Keycloak.
=======
import { PERMISSIONS_KEY } from '../decorators';

/**
 * ABAC (Attribute-Based Access Control) Guard.
 * Checks if the authenticated user has the required permissions
 * based on their role's permission attributes.
 *
 * Usage with @RequirePermission() decorator:
 *   @UseGuards(AuthGuard('jwt'), AbacGuard)
 *   @RequirePermission('finance:read', 'finance:write')
 *   @Post('transactions')
 *   createTransaction() { ... }
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@Injectable()
export class AbacGuard implements CanActivate {
  private readonly logger = new Logger(AbacGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

<<<<<<< HEAD
    // If no permissions are specified, allow access
=======
    // If no permissions required, allow access
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
<<<<<<< HEAD
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Super admins bypass permission checks
    if (user.roles?.includes('super_admin')) {
      return true;
    }

    const userPermissions = user.permissions || [];

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((required) =>
      this.hasPermission(userPermissions, required),
    );

    if (!hasAllPermissions) {
      this.logger.warn(
        `Permission denied for user ${user.id}: ` +
          `required [${requiredPermissions.join(', ')}], ` +
          `user has [${userPermissions.join(', ')}]`,
=======
    const user = request.user;

    if (!user) {
      this.logger.warn('AbacGuard: No user found in request');
      throw new ForbiddenException('Authentication required');
    }

    // Super admin bypasses all permission checks
    const userRoles: string[] = user.roles || [];
    if (userRoles.includes('super_admin')) {
      return true;
    }

    const userPermissions: string[] = user.permissions || [];

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every((perm) => {
      // Support wildcard permissions (e.g., 'finance:*' matches 'finance:read')
      return userPermissions.some((userPerm) => {
        if (userPerm === '*') return true; // Global wildcard
        if (userPerm.endsWith(':*')) {
          const domain = userPerm.slice(0, -2);
          return perm.startsWith(domain + ':');
        }
        return userPerm === perm;
      });
    });

    if (!hasAllPermissions) {
      this.logger.warn(
        `Permission denied: user ${user.sub || user.id} ` +
        `with permissions [${userPermissions.join(', ')}] ` +
        `missing required [${requiredPermissions.join(', ')}]`,
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
<<<<<<< HEAD

  /**
   * Check if user has a specific permission, supporting wildcards.
   * "accounts:*" matches "accounts:read", "accounts:write", etc.
   * "*:*" matches everything.
   */
  private hasPermission(userPermissions: string[], required: string): boolean {
    if (userPermissions.includes('*:*')) {
      return true;
    }

    if (userPermissions.includes(required)) {
      return true;
    }

    // Check wildcard: "accounts:*" matches "accounts:read"
    const [resource] = required.split(':');
    return userPermissions.includes(`${resource}:*`);
  }
=======
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
}
