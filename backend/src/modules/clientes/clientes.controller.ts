import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { clientesService } from './clientes.service';

export const listClientes = asyncHandler(async (_req: Request, res: Response) => {
  const clientes = await clientesService.findAll();
  sendSuccess(res, 'Clientes obtenidos', clientes);
});

export const getCliente = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await clientesService.findById(req.params.id);
  sendSuccess(res, 'Cliente obtenido', cliente);
});

export const createCliente = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await clientesService.create(req.body);
  sendSuccess(res, 'Cliente creado', cliente, 201);
});

export const updateCliente = asyncHandler(async (req: Request, res: Response) => {
  const cliente = await clientesService.update(req.params.id, req.body);
  sendSuccess(res, 'Cliente actualizado', cliente);
});
