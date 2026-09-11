'use client';

import Link from 'next/link';
import { IconAgregar, IconCajaMas } from '@/client/components/icons';
import { PageShell } from '@/client/components/layout/page-shell';
import { ErrorState } from '@/client/components/shared/error-state';
import { LoadingSkeleton } from '@/client/components/shared/loading-skeleton';
import { Button } from '@/client/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/client/components/ui/card';
import { endpoints } from '@/client/lib/api/endpoints';
import { useApi } from '@/client/hooks/use-api';
import { DashboardKpis } from '@/client/features/dashboard/dashboard-kpis';
import { InventoryAlerts } from '@/client/features/dashboard/inventory-alerts';
import { SalesPanel } from '@/client/features/dashboard/sales-panel';
import { OrdersTable } from '@/client/features/pedidos/orders-table';

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

  // Una sola definicion de la lista, usada por la vista de movil y la de
  // escritorio: el mismo pedido nunca se pinta distinto segun la pantalla.
  const listaPorConfirmar = (
    <Card>
      <CardHeader>
        {/* Sin el numero al lado: ya lo dice el indicador "Por confirmar" de
            arriba, y la lista esta justo debajo. El mismo dato tres veces en
            una pantalla no lo refuerza, lo convierte en ruido. */}
        <CardTitle>Pedidos por confirmar</CardTitle>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/pedidos">Ver todos los pedidos</Link>
        </Button>
      </CardHeader>
      <OrdersTable
        orders={porConfirmar.length ? porConfirmar : pedidos}
        onUpdated={recargar}
        // Cuando la lista son SOLO los pendientes, la columna Estado dice lo
        // mismo en todas las filas. Cuando cae al listado completo, si
        // distingue, y por eso vuelve.
        ocultarEstado={porConfirmar.length > 0}
        emptyTitle="Nada pendiente"
        emptyDescription="Cuando entre un pedido por WhatsApp o lo captures aqui, aparece en esta lista."
      />
    </Card>
  );

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

          {/* DOS VISTAS, LOS MISMOS DATOS.
              En el celular el dueño no analiza: consulta de un vistazo, en la
              calle, con una mano. Y hasta ahora el telefono le escondia justo
              lo que va a mirar — Ventas y Stock bajo vivian en la columna
              derecha con `hidden xl:flex`, invisibles bajo 1280 px. Aqui
              aparecen, apilados y en el orden en que importan: cuanto llevo,
              que me falta, que tengo que sacar. En pantalla grande manda la
              maqueta de dos columnas, que si aprovecha el ancho. */}

          {/* MOVIL — una sola columna, sin recortar informacion clave */}
          <div className="flex flex-col gap-3 xl:hidden">
            <SalesPanel orders={pedidos} productos={products.data ?? []} />
            <InventoryAlerts rows={inventory.data ?? []} />
            {listaPorConfirmar}
          </div>

          {/* ESCRITORIO — la accion del dia ocupa el ancho; dinero y avisos, la
              columna derecha */}
          <div className="hidden min-h-0 flex-1 gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
            {listaPorConfirmar}

            <div className="flex min-h-0 flex-col gap-3">
              <SalesPanel orders={pedidos} productos={products.data ?? []} />
              <InventoryAlerts rows={inventory.data ?? []} />
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
