import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

/**
 * ABAC (Attribute-Based Access Control) Guard.
 * Evaluates fine-grained permissions from the @RequirePermission() decorator.
 *
 * Permission format: "resource:action" (e.g., "accounts:read")
 * Wildcards supported: "accounts:*" or global "*".
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

    // If no permissions required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
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
    const hasAllPermissions = requiredPermissions.every((perm) =>
      this.hasPermission(userPermissions, perm),
    );

    if (!hasAllPermissions) {
      this.logger.warn(
        `Permission denied: user ${user.userId || user.sub || user.id} ` +
        `missing required [${requiredPermissions.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

  /**
   * Check if user has a specific permission, supporting wildcards.
   */
  private hasPermission(userPermissions: string[], required: string): boolean {
    return userPermissions.some((userPerm) => {
      // 1. Global wildcard
      if (userPerm === '*' || userPerm === '*:*') {
        return true;
      }

      // 2. Exact match
      if (userPerm === required) {
        return true;
      }

      // 3. Resource wildcard: "accounts:*" matches "accounts:read"
      if (userPerm.endsWith(':*')) {
        const domain = userPerm.slice(0, -2);
        return required.startsWith(domain + ':');
      }

      return false;
    });
  }
}
