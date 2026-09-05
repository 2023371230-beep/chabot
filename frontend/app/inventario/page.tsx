'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconCajaMas } from '@/components/icons';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import {
  InventoryMovementForm,
  type InventoryMovementFormValues
} from '@/features/inventario/inventory-movement-form';
import { InventoryMovementsTable } from '@/features/inventario/inventory-movements-table';

/**
 * Inventario responde UNA pregunta: que entro y que salio, y por que.
 *
 * Antes esta pantalla repetia la tabla del catalogo (producto, precio, stock),
 * las mismas tres columnas que ya muestra Productos. Esa duplicacion obligaba
 * al usuario a decidir en cual de las dos pantallas buscar. Ahora:
 *   Productos  -> que vendo, a que precio, cuanto tengo AHORA
 *   Inventario -> el historial de como llegue a ese numero
 */
export default function InventarioPage() {
  const movimientos = useApi(() => endpoints.inventario.movimientos(), []);
  const productos = useApi(() => endpoints.productos.list(), []);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const error = movimientos.error ?? productos.error;

  const save = async (values: InventoryMovementFormValues) => {
    setSubmitting(true);
    try {
      await endpoints.inventario.createMovimiento(values);
      toast.success('Movimiento registrado');
      setOpen(false);
      await Promise.all([movimientos.refetch(), productos.refetch()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo registrar');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      fill
      title="Inventario"
      description="Todo lo que entro y salio del almacen."
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" size="md">
              <IconCajaMas />
              Registrar movimiento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar movimiento</DialogTitle>
            </DialogHeader>
            <InventoryMovementForm
              products={(productos.data ?? []).filter((p) => p.activo)}
              onSubmit={save}
              submitting={submitting}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      }
    >
      {error ? (
        <ErrorState
          title="No se pudo cargar el inventario"
          description={error}
          onRetry={async () => {
            await Promise.all([movimientos.refetch(), productos.refetch()]);
          }}
        />
      ) : (
        <Card className="min-h-0 flex-1">
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
            <span className="text-2xs text-muted-foreground">Del mas reciente al mas viejo</span>
          </CardHeader>
          <InventoryMovementsTable
            rows={movimientos.data ?? []}
            loading={movimientos.loading}
          />
        </Card>
      )}
    </PageShell>
  );
}
