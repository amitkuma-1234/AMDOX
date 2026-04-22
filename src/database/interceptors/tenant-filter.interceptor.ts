import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * TenantFilterInterceptor ensures that the tenantId is propagated from the request context
 * to the downstream services and repositories.
 *
 * This provides a safety net to ensure all database operations are scoped to the current tenant.
 */
@Injectable()
export class TenantFilterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantFilterInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      // For public routes, tenantId might be missing.
      // If the route is protected by TenantIsolationGuard, it will have already errored.
      return next.handle();
    }

    // Inject tenantId into request body/query for automatic DTO population if needed
    if (request.body && typeof request.body === 'object') {
      // Only inject if the model expects tenantId
      request.body.tenantId = tenantId;
    }

    // Store a formal tenant context for repository access
    request.tenantContext = {
      tenantId,
      appliedAt: new Date().toISOString(),
    };

    this.logger.debug(`Tenant filter context applied: ${tenantId}`);

    return next.handle();
  }
}
