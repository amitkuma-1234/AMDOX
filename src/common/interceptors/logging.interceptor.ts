import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logging interceptor for request/response tracking.
 * Logs method, URL, status code, response time, and correlation IDs.
 * Compatible with OpenTelemetry trace context propagation.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Generate or extract correlation ID
    const correlationId = (request.headers['x-request-id'] as string) || uuidv4();
    request.headers['x-request-id'] = correlationId;
    response.setHeader('X-Request-ID', correlationId);

    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    const tenantId = (request as any).tenantId || request.headers['x-tenant-id'] || '-';
    const startTime = Date.now();
    const contentLength = request.get('content-length') || '0';

    // Log incoming request
    this.logger.log(
      `→ ${method} ${url} [tenant:${tenantId}] [${correlationId}] [${ip}] [${userAgent}] [${contentLength}B]`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          const logLevel = statusCode >= 400 ? 'warn' : 'log';

          this.logger[logLevel](
            `← ${method} ${url} ${statusCode} ${duration}ms [tenant:${tenantId}] [${correlationId}]`,
          );

          // Log slow requests
          if (duration > 3000) {
            this.logger.warn(
              `⚠ Slow request: ${method} ${url} took ${duration}ms [${correlationId}]`,
            );
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `✗ ${method} ${url} ERROR ${duration}ms [tenant:${tenantId}] [${correlationId}] ${error.message}`,
          );
        },
      }),
    );
  }
}
