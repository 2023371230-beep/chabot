import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { OrdersTable } from '@/client/features/pedidos/orders-table';
import type { Pedido } from '@/client/types/models';

export function RecentOrders({
  orders,
  onUpdated
}: {
  orders: Pedido[];
  onUpdated?: () => void | Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <OrdersTable orders={orders.slice(0, 6)} onUpdated={onUpdated} />
      </CardContent>
    </Card>
  );
}
