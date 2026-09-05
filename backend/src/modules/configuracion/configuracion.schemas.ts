import { z } from 'zod';

export const configuracionIdParamsSchema = z.object({
  id: z.string().uuid()
});

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora invalido');

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const updateConfiguracionSchema = z
  .object({
    kg_limite_rapido: z.number().gt(0).optional(),
    dias_preparacion_mayoreo: z.number().int().min(0).max(30).optional(),
    horario_apertura: timeSchema.optional(),
    horario_cierre: timeSchema.optional(),
    mensaje_fuera_horario: z.string().trim().optional()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  })
  .refine(
    (data) => {
      if (!data.horario_apertura || !data.horario_cierre) return true;
      return data.horario_apertura !== data.horario_cierre;
    },
    {
      message: 'Horario de apertura y cierre no pueden ser iguales'
    }
  )
  .refine(
    (data) => {
      if (!data.horario_apertura || !data.horario_cierre) return true;
      return timeToMinutes(data.horario_apertura) < timeToMinutes(data.horario_cierre);
    },
    {
      message: 'Horario de apertura debe ser menor que horario de cierre'
    }
  );
