import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
<<<<<<< HEAD
 * Decorator to specify which permissions are required to access an endpoint.
 * Used in conjunction with ABAC Guard for fine-grained access control.
 *
 * @example
 * @RequirePermission('accounts:read', 'accounts:write')
 * @Post('accounts')
 * createAccount() { ... }
=======
 * @RequirePermission() — Mark an endpoint as requiring specific permissions.
 * Works with ABAC Guard to enforce attribute-based access control.
 *
 * Usage:
 *   @RequirePermission('finance:read', 'finance:write')
 *   @Post('transactions')
 *   createTransaction() { ... }
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
