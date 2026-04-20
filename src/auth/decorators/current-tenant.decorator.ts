import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
<<<<<<< HEAD
 * Parameter decorator to extract the current tenant ID from the request.
 *
 * @example
 * @Get('accounts')
 * findAll(@CurrentTenant() tenantId: string) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
=======
 * @CurrentTenant() — Extract the current tenant ID from the request.
 *
 * Usage:
 *   @Get()
 *   findAll(@CurrentTenant() tenantId: string) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
