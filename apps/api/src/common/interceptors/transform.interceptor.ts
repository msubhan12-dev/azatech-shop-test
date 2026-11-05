import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        // If result is already formatted (e.g., has success field), return as-is
        if (result && typeof result === 'object' && 'success' in result) {
          return result as ApiResponse<T>;
        }

        // If result has data and meta, wrap properly
        if (result && typeof result === 'object' && 'data' in result && 'meta' in result) {
          return {
            success: true,
            message: 'OK',
            data: result.data as T,
            meta: result.meta as Record<string, unknown>,
          };
        }

        return {
          success: true,
          message: 'OK',
          data: result as T,
        };
      }),
    );
  }
}
