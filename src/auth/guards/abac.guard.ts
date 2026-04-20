import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
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
      );
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
