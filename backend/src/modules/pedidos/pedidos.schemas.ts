import { z } from 'zod';

export const pedidoEstadoSchema = z.enum([
  'pendiente',
  'confirmado',
  'completado',
  'cancelado'
]);

export const pedidoOrigenSchema = z.enum(['whatsapp', 'dashboard', 'manual']);

export const pedidoIdParamsSchema = z.object({
  id: z.string().uuid()
});

const pedidoProductoSchema = z.object({
  producto_id: z.string().uuid(),
  kg: z.number().gt(0)
});

export const createPedidoSchema = z.object({
  cliente: z
    .object({
      id: z.string().uuid().optional(),
      nombre: z.string().trim().min(1).max(120).optional(),
      telefono: z.string().trim().min(5).max(30),
      direccion: z.string().trim().optional(),
      notas: z.string().trim().optional()
    })
    .refine((cliente) => cliente.id || cliente.telefono, {
      message: 'Debe enviar cliente.id o cliente.telefono'
    }),
  fecha_entrega: z.string().date().optional(),
  origen: pedidoOrigenSchema.optional(),
  notas: z.string().trim().optional(),
  productos: z.array(pedidoProductoSchema).min(1)
});

export const updatePedidoSchema = z
  .object({
    fecha_entrega: z.string().date().optional(),
    estado: pedidoEstadoSchema.optional(),
    notas: z.string().trim().optional(),
    productos: z.array(pedidoProductoSchema).min(1).optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const updatePedidoEstadoSchema = z.object({
  estado: pedidoEstadoSchema
});
