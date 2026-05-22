import { z } from 'zod';

export const configuracionIdParamsSchema = z.object({
  id: z.string().uuid()
});

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Formato de hora invalido');

export const updateConfiguracionSchema = z
  .object({
    kg_limite_rapido: z.number().gt(0).optional(),
    dias_preparacion_mayoreo: z.number().int().min(0).optional(),
    horario_apertura: timeSchema.optional(),
    horario_cierre: timeSchema.optional(),
    mensaje_fuera_horario: z.string().trim().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });
