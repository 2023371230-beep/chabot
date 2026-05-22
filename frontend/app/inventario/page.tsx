'use client';

import { PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import {
  InventoryMovementForm,
  type InventoryMovementFormValues
} from '@/features/inventario/inventory-movement-form';
import { InventoryMovementsTable } from '@/features/inventario/inventory-movements-table';
import { InventorySummary } from '@/features/inventario/inventory-summary';

export default function InventarioPage() {
  const resumen = useApi(() => endpoints.inventario.resumen(), []);
  const movimientos = useApi(() => endpoints.inventario.movimientos(), []);
  const productos = useApi(() => endpoints.productos.list(), []);
  const [submitting, setSubmitting] = useState(false);

  const save = async (values: InventoryMovementFormValues) => {
    setSubmitting(true);
    try {
      await endpoints.inventario.createMovimiento(values);
      toast.success('Movimiento registrado');
      await Promise.all([resumen.refetch(), movimientos.refetch(), productos.refetch()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo registrar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Lectura rapida de stock y movimientos que impactan productos."
      />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Registrar movimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <InventoryMovementForm
              products={(productos.data ?? []).filter((p) => p.activo)}
              onSubmit={save}
              submitting={submitting}
            />
          </CardContent>
        </Card>
        <InventorySummary rows={resumen.data ?? []} loading={resumen.loading} />
        <InventoryMovementsTable
          rows={movimientos.data ?? []}
          loading={movimientos.loading}
        />
      </div>
    </>
  );
}
