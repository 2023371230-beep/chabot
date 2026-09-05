'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { IconAgregar, IconAlerta, IconBorrar, IconCargando } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FormFooter } from '@/components/ui/field';
import { AffixInput, Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatKg } from '@/lib/formatters';
import type { Cliente, Producto } from '@/types/models';

const schema = z
  .object({
    cliente_id: z.string().optional(),
    nombre: z.string().trim().optional(),
    telefono: z
      .string()
      .trim()
      .min(7, 'Escribe al menos 7 digitos')
      .max(30, 'Maximo 30 caracteres'),
    direccion: z.string().optional(),
    fecha_entrega: z
      .string()
      .optional()
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha invalida'),
    origen: z.enum(['dashboard', 'manual', 'whatsapp']),
    notas: z.string().optional(),
    productos: z
      .array(
        z.object({
          producto_id: z.string().min(1, 'Elige un producto'),
          kg: z.coerce
            .number()
            .gt(0, 'Los kilos deben ser mayores a 0')
            .max(10000, 'Maximo 10000 kg')
        })
      )
      .min(1)
      .max(20, 'Maximo 20 renglones por pedido')
  })
  .refine((v) => v.cliente_id || v.origen === 'whatsapp' || v.nombre?.trim(), {
    message: 'Escribe el nombre del cliente',
    path: ['nombre']
  });

export type OrderFormValues = z.infer<typeof schema>;

/** El enum crudo no le dice nada al usuario; esto si. */
const ORIGENES: { valor: OrderFormValues['origen']; etiqueta: string }[] = [
  { valor: 'dashboard', etiqueta: 'Lo capturo yo aqui' },
  { valor: 'manual', etiqueta: 'Por telefono o en persona' },
  { valor: 'whatsapp', etiqueta: 'Llego por WhatsApp' }
];

export function OrderForm({
  clients,
  products,
  warnings,
  submitting,
  onSubmit,
  onCancel
}: {
  clients: Cliente[];
  products: Producto[];
  warnings?: string[];
  submitting?: boolean;
  onSubmit: (values: unknown) => Promise<void>;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors }
  } = useForm<OrderFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cliente_id: '',
      nombre: '',
      telefono: '',
      direccion: '',
      fecha_entrega: '',
      origen: 'dashboard',
      notas: '',
      productos: [{ producto_id: '', kg: 1 }]
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'productos' });
  const renglones = watch('productos');

  const totales = useMemo(() => {
    return (renglones ?? []).reduce(
      (acc, item) => {
        const producto = products.find((p) => p.id === item.producto_id);
        const kg = Number(item.kg || 0);
        return {
          kg: acc.kg + kg,
          total: acc.total + kg * Number(producto?.precio_kg ?? 0)
        };
      },
      { kg: 0, total: 0 }
    );
  }, [products, renglones]);

  const submit = async (values: OrderFormValues) => {
    await onSubmit({
      cliente: {
        id: values.cliente_id || undefined,
        nombre: values.nombre || undefined,
        telefono: values.telefono,
        direccion: values.direccion || undefined
      },
      fecha_entrega: values.fecha_entrega || undefined,
      origen: values.origen,
      notas: values.notas || undefined,
      productos: values.productos
    });
    reset();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      {warnings?.length ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-3">
          <IconAlerta className="mt-px shrink-0 text-warning" />
          <ul className="flex flex-col gap-1 text-xs text-foreground">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <FieldGroup title="Cliente">
        <Field label="Buscar cliente registrado">
          <Select
            value={watch('cliente_id')}
            onValueChange={(id) => {
              const c = clients.find((x) => x.id === id);
              setValue('cliente_id', id);
              if (c) {
                setValue('nombre', c.nombre ?? '');
                setValue('telefono', c.telefono);
                setValue('direccion', c.direccion ?? '');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Elige uno o captura los datos abajo" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre ?? c.telefono} · {c.telefono}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" required error={errors.nombre?.message}>
            <Input placeholder="Restaurante El Centro" {...register('nombre')} />
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

        <Field label="Direccion de entrega" error={errors.direccion?.message}>
          <Input placeholder="Av. Principal 123" {...register('direccion')} />
        </Field>
      </FieldGroup>

      <FieldGroup title="Productos">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-md border border-border bg-surface-2/40 p-2.5 sm:grid-cols-[minmax(0,1fr)_120px_auto]"
          >
            <Field label={`Producto ${index + 1}`}>
              <Select
                value={watch(`productos.${index}.producto_id`)}
                onValueChange={(v) => setValue(`productos.${index}.producto_id`, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Elige un producto" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter((p) => p.activo)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} · {formatCurrency(p.precio_kg)}/kg
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cantidad" error={errors.productos?.[index]?.kg?.message}>
              <AffixInput
                type="number"
                step="0.01"
                min="0"
                suffix="kg"
                {...register(`productos.${index}.kg`)}
              />
            </Field>
            <div className="flex items-end pb-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={fields.length === 1}
                title={
                  fields.length === 1
                    ? 'El pedido necesita al menos un producto'
                    : 'Quitar este renglon'
                }
                aria-label={`Quitar el producto ${index + 1} del pedido`}
                onClick={() => fields.length > 1 && remove(index)}
              >
                <IconBorrar />
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={fields.length >= 20}
          onClick={() => append({ producto_id: '', kg: 1 })}
        >
          <IconAgregar />
          Agregar otro producto
        </Button>

        {/* Total en vivo: el usuario ve el efecto de lo que captura sin tener
            que enviar el formulario para enterarse. */}
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2/60 px-3 py-2.5">
          <span className="label">Total del pedido</span>
          <span className="num text-md font-semibold">
            {formatKg(totales.kg)} · {formatCurrency(totales.total)}
          </span>
        </div>
      </FieldGroup>

      <FieldGroup title="Entrega">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Fecha de entrega"
            hint="Si pasa de 50 kg, necesita 2 dias de preparacion."
            error={errors.fecha_entrega?.message}
          >
            <Input type="date" {...register('fecha_entrega')} />
          </Field>
          <Field label="Como llego el pedido">
            <Select
              value={watch('origen')}
              onValueChange={(v) => setValue('origen', v as OrderFormValues['origen'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGENES.map((o) => (
                  <SelectItem key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Notas para la entrega">
          <Textarea
            placeholder="Separar en bolsas, entregar por la manana..."
            {...register('notas')}
          />
        </Field>
      </FieldGroup>

      <FormFooter note="El pedido se guarda como pendiente. El stock no se mueve hasta que lo confirmes.">
        {onCancel ? (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size="lg" disabled={submitting}>
          {submitting ? <IconCargando className="animate-spin" /> : null}
          Crear pedido
        </Button>
      </FormFooter>
    </form>
  );
}
