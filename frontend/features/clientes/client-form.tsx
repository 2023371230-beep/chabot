'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Cliente } from '@/types/models';

const schema = z.object({
  nombre: z.string().optional(),
  telefono: z.string().min(5, 'Telefono requerido'),
  direccion: z.string().optional(),
  notas: z.string().optional()
});

export type ClientFormValues = z.infer<typeof schema>;

export function ClientForm({
  client,
  onSubmit,
  submitting
}: {
  client?: Cliente | null;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  submitting?: boolean;
}) {
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
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" error={errors.nombre?.message}>
          <Input placeholder="Restaurante El Centro" {...register('nombre')} />
        </Field>
        <Field label="Telefono" error={errors.telefono?.message}>
          <Input placeholder="4421234567" {...register('telefono')} />
        </Field>
      </div>
      <Field label="Direccion" error={errors.direccion?.message}>
        <Input placeholder="Av. Principal 123" {...register('direccion')} />
      </Field>
      <Field label="Notas" error={errors.notas?.message}>
        <Textarea placeholder="Preferencias de entrega" {...register('notas')} />
      </Field>
      <Button disabled={submitting} className="justify-self-end">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Guardar cliente
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
