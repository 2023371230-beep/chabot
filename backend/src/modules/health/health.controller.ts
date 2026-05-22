import type { Request, Response } from 'express';
export const getHealth = (_req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Backend running',
    timestamp: new Date().toISOString()
  });
};
