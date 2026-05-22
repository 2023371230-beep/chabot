'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { inventoryTypes } from '@/lib/constants';
import type { Producto } from '@/types/models';

const schema = z.object({
  producto_id: z.string().min(1, 'Selecciona un producto'),
  tipo: z.enum(['entrada', 'venta', 'ajuste', 'merma']),
  cantidad_kg: z.coerce.number().gt(0, 'Debe ser mayor a 0'),
  motivo: z.string().optional()
});

export type InventoryMovementFormValues = z.infer<typeof schema>;

export function InventoryMovementForm({
  products,
  submitting,
  onSubmit
}: {
  products: Producto[];
  submitting?: boolean;
  onSubmit: (values: InventoryMovementFormValues) => Promise<void>;
}) {
  const {
    register,
    setValue,
    watch,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<InventoryMovementFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { producto_id: '', tipo: 'entrada', cantidad_kg: 1, motivo: '' }
  });

  const submit = async (values: InventoryMovementFormValues) => {
    await onSubmit(values);
    reset({ producto_id: '', tipo: 'entrada', cantidad_kg: 1, motivo: '' });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Producto</Label>
          <Select
            value={watch('producto_id')}
            onValueChange={(v) => setValue('producto_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona producto" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.producto_id ? (
            <p className="text-xs text-danger">{errors.producto_id.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={watch('tipo')}
            onValueChange={(v) =>
              setValue('tipo', v as InventoryMovementFormValues['tipo'])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inventoryTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Cantidad kg</Label>
          <Input type="number" step="0.01" {...register('cantidad_kg')} />
          {errors.cantidad_kg ? (
            <p className="text-xs text-danger">{errors.cantidad_kg.message}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Motivo</Label>
        <Textarea
          placeholder="Compra a proveedor, merma, ajuste operativo..."
          {...register('motivo')}
        />
      </div>
      <Button disabled={submitting} className="justify-self-end">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Registrar movimiento
      </Button>
    </form>
  );
}
