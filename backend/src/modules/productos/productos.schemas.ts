import { z } from 'zod';

export const productoIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  categoria: z.string().trim().max(100).optional(),
  precio_kg: z.number().min(0),
  stock_actual: z.number().min(0).optional(),
  stock_minimo: z.number().min(0).optional()
});

export const updateProductoSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    categoria: z.string().trim().max(100).optional(),
    precio_kg: z.number().min(0).optional(),
    stock_actual: z.number().min(0).optional(),
    stock_minimo: z.number().min(0).optional(),
    activo: z.boolean().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });
