import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @RequirePermission() — Mark an endpoint as requiring specific permissions.
 * Works with ABAC Guard to enforce attribute-based access control.
 *
 * Usage:
 *   @RequirePermission('finance:read', 'finance:write')
 *   @Post('transactions')
 *   createTransaction() { ... }
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
