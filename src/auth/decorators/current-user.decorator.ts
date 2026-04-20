import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
<<<<<<< HEAD
 * Authenticated user payload extracted from JWT.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  keycloakId: string;
  roles: string[];
  permissions: string[];
}

/**
 * Parameter decorator to extract the current authenticated user from the request.
 * Optionally accepts a property name to extract a specific field.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
=======
 * @CurrentUser() — Extract the current authenticated user from the request.
 *
 * Usage:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: JwtPayload) { ... }
 *
 *   @Get('email')
 *   getEmail(@CurrentUser('email') email: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
