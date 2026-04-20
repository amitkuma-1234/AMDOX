import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
<<<<<<< HEAD
import { trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * Global logging interceptor with OpenTelemetry trace context.
 * Logs request/response details and attaches trace IDs for distributed tracing.
=======
import { v4 as uuidv4 } from 'uuid';

/**
 * Logging interceptor for request/response tracking.
 * Logs method, URL, status code, response time, and correlation IDs.
 * Compatible with OpenTelemetry trace context propagation.
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

<<<<<<< HEAD
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = (headers['x-request-id'] as string) || 'no-request-id';
    const startTime = Date.now();

    // Get OpenTelemetry trace context
    const activeSpan = trace.getActiveSpan();
    const traceId = activeSpan?.spanContext()?.traceId || 'no-trace';
    const spanId = activeSpan?.spanContext()?.spanId || 'no-span';

    // Set trace attributes
    if (activeSpan) {
      activeSpan.setAttribute('http.method', method);
      activeSpan.setAttribute('http.url', url);
      activeSpan.setAttribute('http.user_agent', userAgent);
      activeSpan.setAttribute('request.id', requestId);
    }

    this.logger.log(
      `→ ${method} ${url} [${requestId}] [trace:${traceId.substring(0, 8)}] from ${ip}`,
=======
    // Generate or extract correlation ID
    const correlationId =
      (request.headers['x-request-id'] as string) || uuidv4();
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
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;
<<<<<<< HEAD

          if (activeSpan) {
            activeSpan.setAttribute('http.status_code', statusCode);
            activeSpan.setAttribute('http.response_time_ms', duration);
            activeSpan.setStatus({ code: SpanStatusCode.OK });
          }

          const logMessage = `← ${method} ${url} ${statusCode} ${duration}ms [${requestId}]`;

          if (duration > 3000) {
            this.logger.warn(`${logMessage} [SLOW]`);
          } else {
            this.logger.log(logMessage);
=======
          const logLevel = statusCode >= 400 ? 'warn' : 'log';

          this.logger[logLevel](
            `← ${method} ${url} ${statusCode} ${duration}ms [tenant:${tenantId}] [${correlationId}]`,
          );

          // Log slow requests
          if (duration > 3000) {
            this.logger.warn(
              `⚠ Slow request: ${method} ${url} took ${duration}ms [${correlationId}]`,
            );
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
<<<<<<< HEAD

          if (activeSpan) {
            activeSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            activeSpan.recordException(error);
          }

          this.logger.error(
            `← ${method} ${url} ERROR ${duration}ms [${requestId}]: ${error.message}`,
=======
          this.logger.error(
            `✗ ${method} ${url} ERROR ${duration}ms [tenant:${tenantId}] [${correlationId}] ${error.message}`,
>>>>>>> 55b9cafb78f7dbadc4be17100cb27b4695dd171b
          );
        },
      }),
    );
  }
}
