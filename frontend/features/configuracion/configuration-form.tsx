'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { IconCargando } from '@/components/icons';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ConfiguracionEmpresa } from '@/types/models';

const schema = z.object({
  kg_limite_rapido: z.coerce.number().gt(0, 'Debe ser mayor a 0'),
  dias_preparacion_mayoreo: z.coerce
    .number()
    .int('Debe ser entero')
    .min(0, 'Debe ser mayor o igual a 0')
    .max(30, 'Maximo 30 dias'),
  horario_apertura: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora invalida'),
  horario_cierre: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora invalida'),
  mensaje_fuera_horario: z.string().optional()
}).refine((values) => values.horario_apertura !== values.horario_cierre, {
  message: 'Apertura y cierre no pueden ser iguales',
  path: ['horario_cierre']
}).refine((values) => values.horario_apertura < values.horario_cierre, {
  message: 'El cierre debe ser despues de la apertura',
  path: ['horario_cierre']
});

export type ConfigurationFormValues = z.infer<typeof schema>;

export function ConfigurationForm({
  config,
  submitting,
  onSubmit
}: {
  config: ConfiguracionEmpresa;
  submitting?: boolean;
  onSubmit: (values: ConfigurationFormValues) => Promise<void>;
}) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<ConfigurationFormValues>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    reset({
      kg_limite_rapido: Number(config.kg_limite_rapido),
      dias_preparacion_mayoreo: config.dias_preparacion_mayoreo,
      horario_apertura: config.horario_apertura?.slice(0, 5),
      horario_cierre: config.horario_cierre?.slice(0, 5),
      mensaje_fuera_horario: config.mensaje_fuera_horario ?? ''
    });
  }, [config, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Kg limite rapido</Label>
          <Input type="number" step="0.01" {...register('kg_limite_rapido')} />
          {errors.kg_limite_rapido ? (
            <p className="text-xs text-danger">{errors.kg_limite_rapido.message}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Los pedidos mayores a este limite requieren preparacion especial.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Dias preparacion mayoreo</Label>
          <Input type="number" {...register('dias_preparacion_mayoreo')} />
          {errors.dias_preparacion_mayoreo ? (
            <p className="text-xs text-danger">
              {errors.dias_preparacion_mayoreo.message}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Dias minimos de preparacion para pedidos mayores al limite.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Horario apertura</Label>
          <Input type="time" {...register('horario_apertura')} />
          {errors.horario_apertura ? (
            <p className="text-xs text-danger">{errors.horario_apertura.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Horario cierre</Label>
          <Input type="time" {...register('horario_cierre')} />
          {errors.horario_cierre ? (
            <p className="text-xs text-danger">{errors.horario_cierre.message}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Mensaje fuera de horario</Label>
        <Textarea {...register('mensaje_fuera_horario')} />
        <p className="text-xs text-muted-foreground">
          Horario usado para respuestas automaticas fuera de horario.
        </p>
      </div>
      <Button disabled={submitting} className="w-full sm:w-auto sm:justify-self-end">
        {submitting ? <IconCargando className="h-4 w-4 animate-spin" /> : null}
        Guardar configuracion
      </Button>
    </form>
  );
}
