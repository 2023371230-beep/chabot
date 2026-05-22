import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject, ZodTypeAny } from 'zod';
import { AppError } from '../errors/AppError';

type RequestSchemas = {
  body?: AnyZodObject | ZodTypeAny;
  params?: AnyZodObject | ZodTypeAny;
  query?: AnyZodObject | ZodTypeAny;
};

export const validateRequest =
  (schemas: RequestSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }

      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }

      next();
    } catch (error) {
      if (error && typeof error === 'object' && 'errors' in error) {
        const issues = (error as { errors: unknown[] }).errors;
        next(new AppError('Datos invalidos', 400, issues));
        return;
      }

      next(error);
    }
  };
