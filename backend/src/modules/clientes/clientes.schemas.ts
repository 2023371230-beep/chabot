import { z } from 'zod';

export const clienteIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createClienteSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  telefono: z.string().trim().min(7).max(30),
  direccion: z.string().trim().optional(),
  notas: z.string().trim().optional()
});

export const updateClienteSchema = z
  .object({
    nombre: z.string().trim().min(1).max(120).optional(),
    telefono: z.string().trim().min(7).max(30).optional(),
    direccion: z.string().trim().optional(),
    notas: z.string().trim().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });
