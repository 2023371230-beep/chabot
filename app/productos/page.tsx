'use client';

import { IconAgregar } from '@/client/components/icons';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageShell } from '@/client/components/layout/page-shell';
import { ErrorState } from '@/client/components/shared/error-state';
import { Button } from '@/client/components/ui/button';
import { Card } from '@/client/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/client/components/ui/dialog';
import { endpoints } from '@/client/lib/api/endpoints';
import { useApi } from '@/client/hooks/use-api';
import type { Producto } from '@/client/types/models';
import { ProductForm, type ProductFormValues } from '@/client/features/productos/product-form';
import { ProductsTable } from '@/client/features/productos/products-table';

export default function ProductosPage() {
  const { data, loading, error, refetch } = useApi(() => endpoints.productos.list(), [], 'productos');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const products = useMemo(() => data ?? [], [data]);

  const save = async (values: ProductFormValues) => {
    setSubmitting(true);
    try {
      if (editing) await endpoints.productos.update(editing.id, values);
      else await endpoints.productos.create(values);
      toast.success(editing ? 'Producto actualizado' : 'Producto creado');
      setOpen(false);
      setEditing(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (product: Producto) => {
    try {
      if (product.activo) await endpoints.productos.desactivar(product.id);
      else await endpoints.productos.activar(product.id);
      toast.success(product.activo ? 'Producto desactivado' : 'Producto activado');
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar');
    }
  };

  return (
    <PageShell
      fill
        title="Productos"
        description="Catalogo operativo con precio por kilogramo, stock actual y minimo."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <IconAgregar className="h-4 w-4" />
                Nuevo producto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
                <DialogDescription>
                  Lo que captures aqui es lo que se usa para calcular los pedidos.
                </DialogDescription>
              </DialogHeader>
              <ProductForm
                product={editing}
                onSubmit={save}
                submitting={submitting}
                onCancel={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        }
    >     {error ? (
        <ErrorState
          title="No se pudieron cargar los productos"
          description={error}
          onRetry={refetch}
        />
      ) : null}
      {!error ? (
        <Card className="min-h-0 flex-1">
        <ProductsTable
          products={products}
          loading={loading}
          onToggle={toggle}
          onEdit={(product) => {
            setEditing(product);
            setOpen(true);
          }}
        />
        </Card>
      ) : null}
    </PageShell>
  );
}
