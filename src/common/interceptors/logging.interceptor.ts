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

/**
 * Global logging interceptor with OpenTelemetry trace context.
 * Logs request/response details and attaches trace IDs for distributed tracing.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

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
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

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
            `← ${method} ${url} ERROR ${duration}ms [${requestId}]: ${error.message}`,
          );
        },
      }),
    );
  }
}
