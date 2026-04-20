import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentTenant() — Extract the current tenant ID from the request.
 *
 * Usage:
 *   @Get()
 *   findAll(@CurrentTenant() tenantId: string) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
