import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Security Exception Filter — sanitizes error responses.
 * Strips stack traces in production, standardizes error format.
 */
@Catch()
export class SecurityExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SecurityExceptionFilter.name);
  private readonly isDev = process.env.NODE_ENV !== 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        message = (resp as any).message ?? message;
        error = (resp as any).error ?? error;
      }
    }

    // Log all 5xx errors
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}: ${message}`,
        this.isDev && exception instanceof Error ? exception.stack : '',
      );
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
      // Only include stack trace in development
      ...(this.isDev && exception instanceof Error ? { stack: exception.stack } : {}),
    });
  }
}
