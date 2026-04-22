import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @RequireRole() — Mark an endpoint as requiring specific roles.
 * Works with RolesGuard to enforce RBAC.
 *
 * Usage:
 *   @RequireRole('admin', 'tenant_admin')
 *   @Get('admin')
 *   adminOnly() { ... }
 */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
