import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { inventarioService } from './inventario.service';

export const listMovimientos = asyncHandler(async (_req: Request, res: Response) => {
  const movimientos = await inventarioService.findMovimientos();
  sendSuccess(res, 'Movimientos obtenidos', movimientos);
});

export const createMovimiento = asyncHandler(async (req: Request, res: Response) => {
  const movimiento = await inventarioService.createMovimiento(req.body);
  sendSuccess(res, 'Movimiento registrado', movimiento, 201);
});

export const getResumenInventario = asyncHandler(async (_req: Request, res: Response) => {
  const resumen = await inventarioService.getResumen();
  sendSuccess(res, 'Resumen de inventario obtenido', resumen);
});
