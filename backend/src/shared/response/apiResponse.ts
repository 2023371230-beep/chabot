import type { Response } from 'express';

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200
): void => {
  const warnings =
    data && typeof data === 'object' && 'warnings' in data
      ? (data as { warnings?: string[] }).warnings
      : undefined;

  res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    ...(warnings?.length ? { warnings } : {})
  });
};

export const sendError = (
  res: Response,
  message: string,
  errors: unknown[] = [],
  statusCode = 400
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};
