import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentTenant() — Parameter decorator to extract the current tenant ID from the request.
 * The tenant ID is populated by the TenantContextMiddleware.
 *
 * @example
 * @Get('accounts')
 * findAll(@CurrentTenant() tenantId: string) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
