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
 */
@Injectable()
export class TenantFilterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantFilterInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
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

    return next.handle();
  }
}
