import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { productosService } from './productos.service';

export const listProductos = asyncHandler(async (_req: Request, res: Response) => {
  const productos = await productosService.findAll();
  sendSuccess(res, 'Productos obtenidos', productos);
});

export const getProducto = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.findById(req.params.id);
  sendSuccess(res, 'Producto obtenido', producto);
});

export const createProducto = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.create(req.body);
  sendSuccess(res, 'Producto creado', producto, 201);
});

export const updateProducto = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.update(req.params.id, req.body);
  sendSuccess(res, 'Producto actualizado', producto);
});

export const activarProducto = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.setActive(req.params.id, true);
  sendSuccess(res, 'Producto activado', producto);
});

export const desactivarProducto = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.setActive(req.params.id, false);
  sendSuccess(res, 'Producto desactivado', producto);
});
