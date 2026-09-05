'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { IconAlerta, IconCargando } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FormFooter } from '@/components/ui/field';
import { AffixInput } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatKg } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Producto } from '@/types/models';

const schema = z.object({
  producto_id: z.string().min(1, 'Elige el producto'),
  tipo: z.enum(['entrada', 'venta', 'ajuste', 'merma']),
  cantidad_kg: z.coerce
    .number()
    .gt(0, 'Los kilos deben ser mayores a 0')
    .max(10000, 'Maximo 10000 kg'),
  motivo: z.string().optional()
});

export type InventoryMovementFormValues = z.infer<typeof schema>;

type Tipo = InventoryMovementFormValues['tipo'];

/**
 * El enum crudo (entrada/venta/ajuste/merma) no dice cual suma y cual resta,
 * que es justo lo unico que el usuario necesita saber. Cada opcion lleva su
 * efecto escrito, y abajo se calcula el stock resultante ANTES de guardar.
 */
const TIPOS: { valor: Tipo; etiqueta: string; efecto: 'suma' | 'resta'; ayuda: string }[] = [
  {
    valor: 'entrada',
    etiqueta: 'Entrada — llego mercancia',
    efecto: 'suma',
    ayuda: 'Compra a proveedor o produccion que entra al almacen.'
  },
  {
    valor: 'merma',
    etiqueta: 'Merma — se echo a perder',
    efecto: 'resta',
    ayuda: 'Producto que se perdio. Se descuenta y queda registrado como perdida en Reportes.'
  },
  {
    valor: 'ajuste',
    etiqueta: 'Ajuste — cuadrar el conteo',
    efecto: 'suma',
    ayuda: 'Cuando contaste el almacen y habia mas de lo registrado.'
  },
  {
    valor: 'venta',
    etiqueta: 'Venta — salida directa',
    efecto: 'resta',
    ayuda: 'Solo para ventas que NO pasaron por un pedido. Si el pedido ya se confirmo, el stock ya se descontó y registrarlo aqui lo descontaria dos veces.'
  }
];

export function InventoryMovementForm({
  products,
  submitting,
  onSubmit,
  onCancel
}: {
  products: Producto[];
  submitting?: boolean;
  onSubmit: (values: InventoryMovementFormValues) => Promise<void>;
  onCancel?: () => void;
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

  const tipo = watch('tipo');
  const productoId = watch('producto_id');
  const cantidad = Number(watch('cantidad_kg') || 0);

  const info = TIPOS.find((t) => t.valor === tipo);
  const producto = products.find((p) => p.id === productoId);
  const actual = Number(producto?.stock_actual ?? 0);
  const delta = info?.efecto === 'resta' ? -cantidad : cantidad;
  const resultante = actual + delta;
  const dejaNegativo = Boolean(producto) && resultante < 0;

  const submit = async (values: InventoryMovementFormValues) => {
    await onSubmit(values);
    reset({ producto_id: '', tipo: 'entrada', cantidad_kg: 1, motivo: '' });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
      <FieldGroup>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Producto" required error={errors.producto_id?.message}>
            <Select
              value={productoId}
              onValueChange={(v) => setValue('producto_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elige el producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} · {formatKg(p.stock_actual)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Que paso" required>
            <Select value={tipo} onValueChange={(v) => setValue('tipo', v as Tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Cantidad" required className="sm:col-span-2" error={errors.cantidad_kg?.message}>
            <AffixInput
              type="number"
              step="0.01"
              min="0"
              suffix="kg"
              {...register('cantidad_kg')}
            />
          </Field>
        </div>

        {/* Vista previa del efecto: el usuario ve el stock resultante antes de
            guardar, en vez de enterarse despues de que ya se movio. */}
        {producto ? (
          <div
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border px-3 py-2 text-xs',
              dejaNegativo
                ? 'border-danger/30 bg-danger-soft'
                : 'border-border bg-surface-2/60'
            )}
          >
            <span className="text-muted-foreground">{producto.nombre}:</span>
            <span className="num font-medium">{formatKg(actual)}</span>
            <span className={cn('num font-semibold', delta < 0 ? 'text-danger' : 'text-success')}>
              {delta < 0 ? '−' : '+'} {formatKg(Math.abs(delta))}
            </span>
            <span className="text-muted-foreground">queda en</span>
            <span className={cn('num font-semibold', dejaNegativo && 'text-danger')}>
              {formatKg(resultante)}
            </span>
            {dejaNegativo ? (
              <span className="flex items-center gap-1 text-danger">
                <IconAlerta />
                No hay tanto en existencia
              </span>
            ) : null}
          </div>
        ) : null}

        <Field
          label="Motivo"
        >
          <Textarea
            placeholder="Compra a Distribuidora del Norte, factura 1204..."
            {...register('motivo')}
          />
        </Field>
      </FieldGroup>

      <FormFooter>
        {onCancel ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size="lg" disabled={submitting || dejaNegativo}>
          {submitting ? <IconCargando className="animate-spin" /> : null}
          Registrar movimiento
        </Button>
      </FormFooter>
    </form>
  );
}
