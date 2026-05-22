import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { configuracionService } from './configuracion.service';

export const getConfiguracion = asyncHandler(async (_req: Request, res: Response) => {
  const configuracion = await configuracionService.getCurrent();
  sendSuccess(res, 'Configuracion obtenida', configuracion);
});

export const updateConfiguracion = asyncHandler(async (req: Request, res: Response) => {
  const configuracion = await configuracionService.update(req.params.id, req.body);
  sendSuccess(res, 'Configuracion actualizada', configuracion);
});
