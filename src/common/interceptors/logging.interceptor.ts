import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { v4 as uuidv4 } from 'uuid';

/**
 * Global logging interceptor with OpenTelemetry trace context support.
 * Logs method, URL, status code, response time, tenant ID, and correlation IDs.
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
    const userAgent = request.get('user-agent') || 'unknown';
    const tenantId = (request as any).tenantId || request.headers['x-tenant-id'] || '-';
    const startTime = Date.now();

    // OpenTelemetry Trace Context
    const activeSpan = trace.getActiveSpan();
    const traceId = activeSpan?.spanContext()?.traceId || 'no-trace';

    if (activeSpan) {
      activeSpan.setAttribute('http.method', method);
      activeSpan.setAttribute('http.url', url);
      activeSpan.setAttribute('http.user_agent', userAgent);
      activeSpan.setAttribute('request.id', correlationId);
      activeSpan.setAttribute('tenant.id', tenantId);
    }

    // Log incoming request
    this.logger.log(
      `→ ${method} ${url} [tenant:${tenantId}] [req:${correlationId}] [trace:${traceId.substring(0, 8)}] from ${ip}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
          const logLevel = statusCode >= 400 ? 'warn' : 'log';

          if (activeSpan) {
            activeSpan.setAttribute('http.status_code', statusCode);
            activeSpan.setAttribute('http.response_time_ms', duration);
            activeSpan.setStatus({ code: SpanStatusCode.OK });
          }

          const logMessage = `← ${method} ${url} ${statusCode} ${duration}ms [tenant:${tenantId}] [req:${correlationId}]`;

          this.logger[logLevel](logMessage);

          // Log slow requests
          if (duration > 3000) {
            this.logger.warn(`⚠ Slow request detected: ${method} ${url} took ${duration}ms`);
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;

          if (activeSpan) {
            activeSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            activeSpan.recordException(error);
          }

          this.logger.error(
            `✗ ${method} ${url} ERROR ${duration}ms [tenant:${tenantId}] [req:${correlationId}]: ${error.message}`,
          );
        },
      }),
    );
  }
}
