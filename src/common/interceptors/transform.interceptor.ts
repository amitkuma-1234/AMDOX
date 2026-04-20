import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Standardised API response envelope.
 * Wraps all successful responses in:
 * {
 *   data: T,
 *   meta: { timestamp, path, version },
 *   statusCode: number
 * }
 */
export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    path: string;
    version: string;
  };
  statusCode: number;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: request.url,
          version: process.env.APP_VERSION || '1.0.0',
        },
        statusCode: response.statusCode,
      })),
    );
  }
}
