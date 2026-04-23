import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
  correlationId: string;
  timestamp: string;
  path: string;
  method: string;
}

/**
 * Global exception filter that catches all unhandled exceptions
 * and returns structured error responses with correlation IDs.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const correlationId = (request.headers['x-request-id'] as string) || uuidv4();
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

    let status: number;
    let message: string;
    let error: string;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        error = (resp.error as string) || HttpStatus[status] || 'Error';
        details = resp.details || undefined;

        // Handle validation errors from class-validator
        if (Array.isArray(resp.message)) {
          message = 'Validation failed';
          details = resp.message;
        }
      } else {
        message = exception.message;
        error = HttpStatus[status] || 'Error';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = isDevelopment ? exception.message : 'An unexpected error occurred';
      error = 'Internal Server Error';

      // Log the full stack trace for server errors
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url} [${correlationId}]`,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'Internal Server Error';

      this.logger.error(
        `Unknown exception type: ${JSON.stringify(exception)}`,
        undefined,
        `${request.method} ${request.url} [${correlationId}]`,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      correlationId,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Only include details in development or for validation errors
    if (details && (isDevelopment || status === HttpStatus.BAD_REQUEST)) {
      errorResponse.details = details;
    }

    // Log non-500 errors at warn level
    if (status < 500) {
      this.logger.warn(
        `${request.method} ${request.url} → ${status} ${message} [${correlationId}]`,
      );
    }

    // Set correlation ID header
    response.setHeader('X-Request-ID', correlationId);
    response.status(status).json(errorResponse);
  }
}
