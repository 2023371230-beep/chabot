'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { IconCargando } from '@/components/icons';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FormFooter } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Cliente } from '@/types/models';

const schema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido').max(120, 'Maximo 120 caracteres'),
  telefono: z.string().trim().min(7, 'Telefono requerido').max(30, 'Maximo 30 caracteres'),
  direccion: z.string().optional(),
  notas: z.string().optional()
});

export type ClientFormValues = z.infer<typeof schema>;

export function ClientForm({
  client,
  onSubmit,
  submitting,
  onCancel
}: {
  client?: Cliente | null;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  submitting?: boolean;
  onCancel?: () => void;
}) {
  const editando = Boolean(client);
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<ClientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', telefono: '', direccion: '', notas: '' }
  });

  useEffect(() => {
    reset({
      nombre: client?.nombre ?? '',
      telefono: client?.telefono ?? '',
      direccion: client?.direccion ?? '',
      notas: client?.notas ?? ''
    });
  }, [client, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.nombre?.message}>
            <Input
              placeholder="Restaurante El Centro"
              autoFocus={!editando}
              {...register('nombre')}
            />
          </Field>
          <Field
            label="Telefono"
            required
            error={errors.telefono?.message}
          >
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="527352233942"
              {...register('telefono')}
            />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup title="Entrega">
        <Field label="Direccion" error={errors.direccion?.message}>
          <Input placeholder="Av. Principal 123" {...register('direccion')} />
        </Field>
        <Field
          label="Notas"
          error={errors.notas?.message}
        >
          <Textarea placeholder="Recibe solo antes de las 11, preguntar por Lupita..." {...register('notas')} />
        </Field>
      </FieldGroup>

      <FormFooter>
        {onCancel ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? <IconCargando className="animate-spin" /> : null}
          {editando ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </FormFooter>
    </form>
  );
}

