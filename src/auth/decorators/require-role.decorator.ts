import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are required to access an endpoint.
 * Used in conjunction with RolesGuard.
 *
 * @example
 * @RequireRole('admin', 'tenant_admin')
 * @Get('admin-panel')
 * getAdminPanel() { ... }
 */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
