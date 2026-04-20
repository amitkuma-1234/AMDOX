import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Global HTTP exception filter.
 * Catches all exceptions and returns a standardised error response envelope.
 *
 * Response format:
 * {
 *   statusCode: number,
 *   error: string,
 *   message: string | string[],
 *   timestamp: string,
 *   path: string,
 *   requestId: string
 * }
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string | string[]) || exception.message;
        error = (responseObj.error as string) || HttpStatus[status] || 'Error';
      } else {
        message = exception.message;
        error = HttpStatus[status] || 'Error';
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message;
      error = 'Internal Server Error';

      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        `${request.method} ${request.url}`,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'Internal Server Error';
    }

    const errorResponse = {
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    // Log 4xx and 5xx differently
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} → ${status}`,
        JSON.stringify(errorResponse),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} → ${status}: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
