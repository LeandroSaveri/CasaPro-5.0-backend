import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from './AppError';
import logger from '../../config/logger';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    errors?: Record<string, string[]>;
    stack?: string;
  };
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  };

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    response.error.code = err.code;
    response.error.message = err.message;

    if (err instanceof ValidationError) {
      response.error.errors = err.errors;
    }

    if (err.isOperational) {
      logger.warn('Operational error', {
        code: err.code,
        message: err.message,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
    } else {
      logger.error('Programming error', {
        code: err.code,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
    }
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    statusCode = 400;
    response.error.code = 'INVALID_JSON';
    response.error.message = 'Invalid JSON payload';
    logger.warn('Invalid JSON', { path: req.path, method: req.method });
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    response.error.code = 'UNAUTHORIZED';
    response.error.message = 'Invalid token';
    logger.warn('JWT error', { path: req.path, method: req.method });
  } else {
    logger.error('Unexpected error', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  }

  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
