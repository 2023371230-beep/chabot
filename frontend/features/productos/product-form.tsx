'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { IconCargando } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FormFooter } from '@/components/ui/field';
import { AffixInput, Input } from '@/components/ui/input';
import type { Producto } from '@/types/models';

const schema = z.object({
  nombre: z.string().min(1, 'Escribe el nombre del producto'),
  categoria: z.string().optional(),
  precio_kg: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  stock_actual: z.coerce.number().min(0, 'El stock no puede ser negativo').optional(),
  stock_minimo: z.coerce.number().min(0, 'El minimo no puede ser negativo').optional()
});

export type ProductFormValues = z.infer<typeof schema>;

export function ProductForm({
  product,
  onSubmit,
  submitting,
  onCancel
}: {
  product?: Producto | null;
  onSubmit: (values: ProductFormValues) => Promise<void>;
  submitting?: boolean;
  onCancel?: () => void;
}) {
  const editando = Boolean(product);

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
    reset(
      product
        ? {
            nombre: product.nombre,
            categoria: product.categoria ?? 'pollo',
            precio_kg: Number(product.precio_kg),
            stock_actual: Number(product.stock_actual),
            stock_minimo: Number(product.stock_minimo)
          }
        : {
            nombre: '',
            categoria: 'pollo',
            precio_kg: 0,
            stock_actual: 0,
            stock_minimo: 0
          }
    );
  }, [product, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.nombre?.message}>
            <Input placeholder="Pechuga" autoFocus={!editando} {...register('nombre')} />
          </Field>
          <Field
            label="Categoria"
            error={errors.categoria?.message}
          >
            <Input placeholder="pollo" {...register('categoria')} />
          </Field>
        </div>
      </FieldGroup>

      <FieldGroup>
        <Field
          label="Precio por kilo"
          required
          error={errors.precio_kg?.message}
        >
          <AffixInput type="number" step="0.01" min="0" prefix="$" {...register('precio_kg')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Existencias">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Stock actual"
            error={errors.stock_actual?.message}
          >
            <AffixInput type="number" step="0.01" min="0" suffix="kg" {...register('stock_actual')} />
          </Field>
          <Field
            label="Minimo de alerta"
            error={errors.stock_minimo?.message}
          >
            <AffixInput type="number" step="0.01" min="0" suffix="kg" {...register('stock_minimo')} />
          </Field>
        </div>
      </FieldGroup>

      <FormFooter note={editando ? undefined : 'El producto queda activo y listo para usarse en pedidos.'}>
        {onCancel ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? <IconCargando className="animate-spin" /> : null}
          {editando ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </FormFooter>
    </form>
  );
}
