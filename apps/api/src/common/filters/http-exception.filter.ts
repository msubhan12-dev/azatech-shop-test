import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        message = exResponse;
      } else if (typeof exResponse === 'object' && exResponse !== null) {
        const resp = exResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? message;
        if (Array.isArray(resp['message'])) {
          // class-validator errors
          errors = this.parseValidationErrors(resp['message'] as string[]);
          message = 'Validasi gagal';
        }
        if (resp['errors']) {
          errors = resp['errors'] as Record<string, string[]>;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        this.isProduction ? undefined : exception.stack,
        'ExceptionFilter',
      );
    }

    const requestId = (request.headers['x-request-id'] as string) || '';

    const body: Record<string, unknown> = {
      success: false,
      message,
      requestId,
    };

    if (errors) body['errors'] = errors;

    if (!this.isProduction && exception instanceof Error && status === 500) {
      body['stack'] = exception.stack;
    }

    response.status(status).json(body);
  }

  private parseValidationErrors(messages: string[]): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    for (const msg of messages) {
      // NestJS validation messages typically are flat strings
      const key = 'validation';
      if (!errors[key]) errors[key] = [];
      errors[key].push(msg);
    }
    return errors;
  }
}
