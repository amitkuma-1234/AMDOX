import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to extract tenant context from the authenticated user's JWT.
 * Injects tenantId into the request object for downstream consumers.
 *
 * This middleware runs after JWT authentication but before route handlers.
 * For unauthenticated routes (health checks), it is excluded via AppModule config.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    // tenantId can come from:
    // 1. JWT payload (set by JwtStrategy after authentication)
    // 2. X-Tenant-ID header (for service-to-service calls)
    const user = (req as any).user;
    const headerTenantId = req.headers['x-tenant-id'] as string;

    if (user?.tenantId) {
      (req as any).tenantId = user.tenantId;
    } else if (headerTenantId) {
      (req as any).tenantId = headerTenantId;
      this.logger.debug(`Tenant context from header: ${headerTenantId}`);
    }

    next();
  }
}
