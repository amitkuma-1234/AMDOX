import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Authenticated user payload extracted from JWT.
 * This matches the object returned by JwtStrategy.validate().
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
}

/**
 * Parameter decorator to extract the current authenticated user from the request.
 * Optionally accepts a property name to extract a specific field.
 *
 * @example
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 * getMyId(@CurrentUser('userId') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
