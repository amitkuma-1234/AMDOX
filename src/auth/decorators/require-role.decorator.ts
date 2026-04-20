import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
<<<<<<< HEAD
 * Decorator to specify which roles are required to access an endpoint.
 * Used in conjunction with RolesGuard.
 *
 * @example
 * @RequireRole('admin', 'tenant_admin')
 * @Get('admin-panel')
 * getAdminPanel() { ... }
 */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
=======
 * @RequireRole() — Mark an endpoint as requiring specific roles.
 * Works with RolesGuard to enforce RBAC.
 *
 * Usage:
 *   @RequireRole('admin', 'tenant_admin')
 *   @Get('admin')
 *   adminOnly() { ... }
 */
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
