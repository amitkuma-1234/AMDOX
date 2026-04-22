import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * TenantContextMiddleware extracts the tenant context from the JWT
 * and injects it into the request for downstream consumption.
 *
 * Tenant ID is resolved from:
 * 1. JWT claim `tenant_id` (primary, set by Keycloak)
 * 2. X-Tenant-ID header (fallback for service-to-service calls)
 * 3. Query parameter `tenantId` (development only)
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    let tenantId: string | undefined;

    // 1. Extract from JWT (set by Passport after authentication)
    const user = (req as any).user;
    if (user?.tenant_id) {
      tenantId = user.tenant_id;
    }

    // 2. Fallback: X-Tenant-ID header (for service-to-service or pre-auth)
    if (!tenantId) {
      const headerTenantId = req.headers['x-tenant-id'] as string;
      if (headerTenantId) {
        tenantId = headerTenantId;
      }
    }

    // 3. Fallback: Query parameter (development only)
    if (!tenantId && process.env.NODE_ENV === 'development') {
      const queryTenantId = req.query.tenantId as string;
      if (queryTenantId) {
        tenantId = queryTenantId;
        this.logger.debug(`Tenant ID from query param (dev only): ${tenantId}`);
      }
    }

    // Inject tenant context into request
    if (tenantId) {
      (req as any).tenantId = tenantId;
    }

    next();
  }
}
