'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { orderOrigins } from '@/lib/constants';
import { formatCurrency, formatKg } from '@/lib/formatters';
import type { Cliente, Producto } from '@/types/models';

const schema = z.object({
  cliente_id: z.string().optional(),
  nombre: z.string().optional(),
  telefono: z.string().min(5, 'Telefono requerido'),
  direccion: z.string().optional(),
  fecha_entrega: z.string().optional(),
  origen: z.enum(['dashboard', 'manual', 'whatsapp']),
  notas: z.string().optional(),
  productos: z
    .array(
      z.object({
        producto_id: z.string().min(1, 'Producto requerido'),
        kg: z.coerce.number().gt(0, 'Kg debe ser mayor a 0')
      })
    )
    .min(1)
});

export type OrderFormValues = z.infer<typeof schema>;

export function OrderForm({
  clients,
  products,
  warnings,
  submitting,
  onSubmit
}: {
  clients: Cliente[];
  products: Producto[];
  warnings?: string[];
  submitting?: boolean;
  onSubmit: (payload: unknown) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
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
  const selectedProducts = watch('productos');

  const totals = useMemo(() => {
    return selectedProducts.reduce(
      (acc, item) => {
        const product = products.find((p) => p.id === item.producto_id);
        const kg = Number(item.kg || 0);
        const subtotal = kg * Number(product?.precio_kg ?? 0);
        return { kg: acc.kg + kg, total: acc.total + subtotal };
      },
      { kg: 0, total: 0 }
    );
  }, [products, selectedProducts]);

  const submit = async (values: OrderFormValues) => {
    const payload = {
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
    };
    await onSubmit(payload);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-5">
      {warnings?.length ? (
        <Alert>
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Cliente existente</Label>
          <Select
            value={watch('cliente_id')}
            onValueChange={(id) => {
              const client = clients.find((item) => item.id === id);
              setValue('cliente_id', id);
              if (client) {
                setValue('nombre', client.nombre ?? '');
                setValue('telefono', client.telefono);
                setValue('direccion', client.direccion ?? '');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cliente o capturar nuevo" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.nombre ?? client.telefono} · {client.telefono}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field label="Nombre" error={errors.nombre?.message}>
          <Input {...register('nombre')} placeholder="Restaurante El Centro" />
        </Field>
        <Field label="Telefono" error={errors.telefono?.message}>
          <Input {...register('telefono')} placeholder="4421234567" />
        </Field>
        <Field label="Direccion" error={errors.direccion?.message}>
          <Input {...register('direccion')} placeholder="Av. Principal 123" />
        </Field>
        <Field label="Fecha entrega" error={errors.fecha_entrega?.message}>
          <Input type="date" {...register('fecha_entrega')} />
        </Field>
        <div className="space-y-2">
          <Label>Origen</Label>
          <Select value={watch('origen')} onValueChange={(v) => setValue('origen', v as OrderFormValues['origen'])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderOrigins.map((origin) => (
                <SelectItem key={origin} value={origin}>
                  {origin}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Productos</h3>
            <p className="text-sm text-muted-foreground">Selecciona producto y kilogramos.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ producto_id: '', kg: 1 })}>
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="grid gap-3 rounded-2xl bg-muted/40 p-3 md:grid-cols-[1fr_140px_auto]">
            <div className="space-y-2">
              <Label>Producto</Label>
              <Select
                value={watch(`productos.${index}.producto_id`)}
                onValueChange={(v) => setValue(`productos.${index}.producto_id`, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.nombre} · {formatCurrency(product.precio_kg)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Kg" error={errors.productos?.[index]?.kg?.message}>
              <Input type="number" step="0.01" {...register(`productos.${index}.kg`)} />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end"
              onClick={() => fields.length > 1 && remove(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-accent p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>Total estimado</span>
        <span className="text-lg font-semibold">
          {formatKg(totals.kg)} · {formatCurrency(totals.total)}
        </span>
      </div>

      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea {...register('notas')} placeholder="Separar en bolsas, entregar por la manana..." />
      </div>

      <Button disabled={submitting} className="justify-self-end">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Crear pedido
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
