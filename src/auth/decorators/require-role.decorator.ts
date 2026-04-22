import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @RequireRole() — Specifies which roles are required to access an endpoint.
 * Works in conjunction with RolesGuard to enforce Role-Based Access Control (RBAC).
 *
 * @example
 * @RequireRole('admin', 'tenant_admin')
 * @Get('admin-panel')
 */
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
