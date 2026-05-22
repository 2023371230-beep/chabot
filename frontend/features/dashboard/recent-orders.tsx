import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrdersTable } from '@/features/pedidos/orders-table';
import type { Pedido } from '@/types/models';

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
