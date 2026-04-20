<<<<<<< HEAD
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * NestJS interceptor that auto-injects tenantId into Prisma queries.
 * Applied at the controller level for tenant-scoped endpoints.
 *
 * This interceptor works alongside the BaseRepository pattern
 * to enforce tenant isolation at the data access layer.
 *
 * NOTE: For most queries, tenantId filtering is handled directly
 * in repositories via the BaseRepository methods. This interceptor
 * provides an additional safety net at the controller level by
 * ensuring tenantId is always available in the request context.
=======
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * TenantFilterInterceptor automatically injects tenantId
 * from the request context into any query body that expects it.
 *
 * This ensures all database operations are scoped to the current tenant
 * without requiring explicit tenant filtering in every controller.
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@Injectable()
export class TenantFilterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantFilterInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
<<<<<<< HEAD
    const user = request.user;

    if (user?.tenantId) {
      // Ensure tenantId is available in request for downstream use
      request.tenantId = user.tenantId;
    } else if (!request.tenantId) {
      this.logger.warn(
        `No tenant context found for request: ${request.method} ${request.url}`,
      );
    }

=======
    const tenantId = request.tenantId;

    if (!tenantId) {
      this.logger.warn('No tenantId found in request context');
      return next.handle();
    }

    // Inject tenantId into request body if it exists
    if (request.body && typeof request.body === 'object') {
      request.body.tenantId = tenantId;
    }

    // Inject tenantId into query params for GET requests
    if (request.query && typeof request.query === 'object') {
      request.query.tenantId = tenantId;
    }

    // Store tenantId on request for repository access
    request.tenantContext = {
      tenantId,
      appliedAt: new Date().toISOString(),
    };

    this.logger.debug(`Tenant filter applied: ${tenantId}`);

>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    return next.handle();
  }
}
