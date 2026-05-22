'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Producto } from '@/types/models';

const schema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  categoria: z.string().optional(),
  precio_kg: z.coerce.number().min(0, 'Debe ser mayor o igual a 0'),
  stock_actual: z.coerce.number().min(0, 'Debe ser mayor o igual a 0').optional(),
  stock_minimo: z.coerce.number().min(0, 'Debe ser mayor o igual a 0').optional()
});

export type ProductFormValues = z.infer<typeof schema>;

export function ProductForm({
  product,
  onSubmit,
  submitting
}: {
  product?: Producto | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitting?: boolean;
}) {
  const {
    register,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: '',
      categoria: 'pollo',
      precio_kg: 0,
      stock_actual: 0,
      stock_minimo: 0
    }
  });

  useEffect(() => {
    if (product) {
      reset({
        nombre: product.nombre,
        categoria: product.categoria ?? 'pollo',
        precio_kg: Number(product.precio_kg),
        stock_actual: Number(product.stock_actual),
        stock_minimo: Number(product.stock_minimo)
      });
    } else {
      reset({
        nombre: '',
        categoria: 'pollo',
        precio_kg: 0,
        stock_actual: 0,
        stock_minimo: 0
      });
    }
  }, [product, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" error={errors.nombre?.message}>
          <Input placeholder="Pechuga" {...register('nombre')} />
        </Field>
        <Field label="Categoria" error={errors.categoria?.message}>
          <Input placeholder="pollo" {...register('categoria')} />
        </Field>
        <Field label="Precio por kg" error={errors.precio_kg?.message}>
          <Input type="number" step="0.01" {...register('precio_kg')} />
        </Field>
        <Field label="Stock actual" error={errors.stock_actual?.message}>
          <Input type="number" step="0.01" {...register('stock_actual')} />
        </Field>
        <Field label="Stock minimo" error={errors.stock_minimo?.message}>
          <Input type="number" step="0.01" {...register('stock_minimo')} />
        </Field>
      </div>
      <Button disabled={submitting} className="justify-self-end">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Guardar producto
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
