import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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

    // If no permissions are specified, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
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
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

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
}
