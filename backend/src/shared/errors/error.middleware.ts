import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../../config/env';
import { AppError } from './AppError';

export const notFoundHandler = (): never => {
  throw new AppError('Ruta no encontrada', 404);
};

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Datos invalidos',
      errors: error.errors
    });
    return;
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message =
    error instanceof AppError ? error.message : 'Error interno del servidor';

  res.status(statusCode).json({
    success: false,
    message,
    errors: error instanceof AppError ? (error.errors ?? []) : [],
    ...(!isProduction && !(error instanceof AppError) ? { stack: error.stack } : {})
  });
};
