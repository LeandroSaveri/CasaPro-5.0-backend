import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';

interface SchemaConfig {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export function validateRequest(schema: SchemaConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        const result = schema.body.safeParse(req.body);
        if (!result.success) {
          const errors = formatZodErrors(result.error);
          throw new ValidationError('Validation failed', errors, 'VALIDATION_ERROR');
        }
        req.body = result.data;
      }

      if (schema.query) {
        const result = schema.query.safeParse(req.query);
        if (!result.success) {
          const errors = formatZodErrors(result.error);
          throw new ValidationError('Query validation failed', errors, 'QUERY_VALIDATION_ERROR');
        }
        req.query = result.data;
      }

      if (schema.params) {
        const result = schema.params.safeParse(req.params);
        if (!result.success) {
          const errors = formatZodErrors(result.error);
          throw new ValidationError('Params validation failed', errors, 'PARAMS_VALIDATION_ERROR');
        }
        req.params = result.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

function formatZodErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.') || 'general';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(err.message);
  });

  return errors;
}
