import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @RequirePermission() — Specifies which fine-grained permissions are required to access an endpoint.
 * Works in conjunction with AbacGuard to enforce Attribute-Based Access Control (ABAC).
 *
 * @example
 * @RequirePermission('accounts:read', 'accounts:write')
 * @Post('accounts')
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
