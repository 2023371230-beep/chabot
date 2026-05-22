'use client';

import { ClipboardPlus, PackagePlus, Settings } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import { DashboardKpis } from '@/features/dashboard/dashboard-kpis';
import { InventoryAlerts } from '@/features/dashboard/inventory-alerts';
import { RecentOrders } from '@/features/dashboard/recent-orders';

export default function DashboardPage() {
  const orders = useApi(() => endpoints.pedidos.list(), []);
  const products = useApi(() => endpoints.productos.list(), []);
  const inventory = useApi(() => endpoints.inventario.resumen(), []);

  const loading = orders.loading || products.loading || inventory.loading;

  if (loading) return <LoadingSkeleton />;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Operacion diaria de pedidos, kilogramos, stock y preparacion de mayoreo."
      />
      <div className="grid gap-6">
        <DashboardKpis
          orders={orders.data ?? []}
          products={products.data ?? []}
          inventory={inventory.data ?? []}
        />
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <RecentOrders orders={orders.data ?? []} onUpdated={orders.refetch} />
          <div className="grid gap-6">
            <InventoryAlerts rows={inventory.data ?? []} />
            <Card>
              <CardHeader>
                <CardTitle>Accesos rapidos</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild>
                  <Link href="/pedidos">
                    <ClipboardPlus className="h-4 w-4" />
                    Nuevo pedido
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/inventario">
                    <PackagePlus className="h-4 w-4" />
                    Registrar movimiento
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/configuracion">
                    <Settings className="h-4 w-4" />
                    Editar configuracion
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
