'use client';

import Link from 'next/link';
import { IconAgregar, IconCajaMas } from '@/components/icons';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import { DashboardKpis } from '@/features/dashboard/dashboard-kpis';
import { InventoryAlerts } from '@/features/dashboard/inventory-alerts';
import { SalesPanel } from '@/features/dashboard/sales-panel';
import { OrdersTable } from '@/features/pedidos/orders-table';

/**
 * Rejilla de altura completa. De arriba abajo:
 *   fila 1  tira de KPIs        (alto propio)
 *   fila 2  trabajo del dia     (ocupa TODO lo que sobra)
 *
 * La fila 2 se parte en dos columnas: la tabla de pedidos por confirmar se
 * lleva el ancho porque es la accion del dia, y la columna derecha lleva
 * dinero y avisos. Ambas scrollean por dentro, asi que la pantalla siempre
 * queda llena sin importar cuantos pedidos haya.
 */
export default function DashboardPage() {
  const orders = useApi(() => endpoints.pedidos.list(), [], 'pedidos');
  const products = useApi(() => endpoints.productos.list(), [], 'productos');
  const inventory = useApi(() => endpoints.inventario.resumen(), [], 'inventario-resumen');

  const loading = orders.loading || products.loading || inventory.loading;
  const error = orders.error ?? products.error ?? inventory.error;

  const recargar = async () => {
    await Promise.all([orders.refetch(), products.refetch(), inventory.refetch()]);
  };

  const pedidos = orders.data ?? [];
  const porConfirmar = pedidos.filter((p) => p.estado === 'pendiente');

  return (
    <PageShell
      fill
      title="Resumen del dia"
      description="Crear un pedido no toca el stock. Solo confirmarlo lo descuenta."
      action={
        <>
          <Button variant="outline" size="md" asChild>
            <Link href="/inventario" title="Registrar entrada, merma o ajuste de stock">
              <IconCajaMas />
              <span className="hidden md:inline">Ajustar stock</span>
            </Link>
          </Button>
          <Button variant="primary" size="md" asChild>
            <Link href="/pedidos">
              <IconAgregar />
              Nuevo pedido
            </Link>
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState
          title="No se pudo cargar la informacion"
          description={error}
          onRetry={recargar}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <DashboardKpis
            orders={pedidos}
            products={products.data ?? []}
            inventory={inventory.data ?? []}
          />

          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader>
                <CardTitle>
                  Pedidos por confirmar
                  {porConfirmar.length ? (
                    <span className="num ml-1.5 text-muted-foreground">
                      {porConfirmar.length}
                    </span>
                  ) : null}
                </CardTitle>
                <Button variant="ghost" size="xs" asChild>
                  <Link href="/pedidos">Ver todos los pedidos</Link>
                </Button>
              </CardHeader>
              <OrdersTable
                orders={porConfirmar.length ? porConfirmar : pedidos}
                onUpdated={recargar}
                emptyTitle="Nada pendiente"
                emptyDescription="Cuando entre un pedido por WhatsApp o lo captures aqui, aparece en esta lista."
              />
            </Card>

            <div className="hidden min-h-0 flex-col gap-3 xl:flex">
              <SalesPanel orders={pedidos} />
              <InventoryAlerts rows={inventory.data ?? []} />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
