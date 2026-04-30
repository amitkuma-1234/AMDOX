import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PiiMasker } from '../utils/pii-masker';

/**
 * Audit Log Interceptor — logs all mutations with PII masking.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');
  private readonly masker = new PiiMasker();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next.handle();

    const auditEntry = {
      method,
      path: request.url,
      userId: request.user?.sub || 'anonymous',
      tenantId: request.user?.tenantId || 'unknown',
      ip: request.ip,
      userAgent: request.headers['user-agent']?.substring(0, 200),
      body: this.masker.maskObject(request.body),
      timestamp: new Date().toISOString(),
    };

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(JSON.stringify({ ...auditEntry, status: 'success' })),
        error: (err) => this.logger.warn(JSON.stringify({ ...auditEntry, status: 'error', error: err.message })),
      }),
    );
  }
}
