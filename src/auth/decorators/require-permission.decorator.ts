import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify which permissions are required to access an endpoint.
 * Used in conjunction with ABAC Guard for fine-grained access control.
 *
 * @example
 * @RequirePermission('accounts:read', 'accounts:write')
 * @Post('accounts')
 * createAccount() { ... }
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
