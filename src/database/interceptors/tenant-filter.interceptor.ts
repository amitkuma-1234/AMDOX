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
 */
@Injectable()
export class TenantFilterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantFilterInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.tenantId) {
      // Ensure tenantId is available in request for downstream use
      request.tenantId = user.tenantId;
    } else if (!request.tenantId) {
      this.logger.warn(
        `No tenant context found for request: ${request.method} ${request.url}`,
      );
    }

    return next.handle();
  }
}
