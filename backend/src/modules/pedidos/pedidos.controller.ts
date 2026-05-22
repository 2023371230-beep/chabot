import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { pedidosService } from './pedidos.service';

export const listPedidos = asyncHandler(async (_req: Request, res: Response) => {
  const pedidos = await pedidosService.findAll();
  sendSuccess(res, 'Pedidos obtenidos', pedidos);
});

export const getPedido = asyncHandler(async (req: Request, res: Response) => {
  const pedido = await pedidosService.findById(req.params.id);
  sendSuccess(res, 'Pedido obtenido', pedido);
});

export const createPedido = asyncHandler(async (req: Request, res: Response) => {
  const result = await pedidosService.createOrder(req.body);
  sendSuccess(res, 'Pedido creado', result, 201);
});

export const updatePedido = asyncHandler(async (req: Request, res: Response) => {
  const result = await pedidosService.updateOrder(req.params.id, req.body);
  sendSuccess(res, 'Pedido actualizado', result);
});

export const updatePedidoEstado = asyncHandler(async (req: Request, res: Response) => {
  const result = await pedidosService.updateOrderStatus(req.params.id, req.body.estado);
  sendSuccess(res, 'Estado de pedido actualizado', result);
});
