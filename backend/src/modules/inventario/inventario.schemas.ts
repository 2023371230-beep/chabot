import { z } from 'zod';

export const inventarioTipoSchema = z.enum(['entrada', 'venta', 'ajuste', 'merma']);

export const createInventarioMovimientoSchema = z.object({
  producto_id: z.string().uuid(),
  tipo: inventarioTipoSchema,
  cantidad_kg: z.number().gt(0),
  motivo: z.string().trim().optional(),
  usuario_id: z.string().uuid().optional(),
  pedido_id: z.string().uuid().optional()
});
