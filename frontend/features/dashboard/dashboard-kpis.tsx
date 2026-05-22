import {
  Boxes,
  ClipboardList,
  MessageCircle,
  PackageSearch,
  Scale,
  TriangleAlert
} from 'lucide-react';
import { MetricCard } from '@/components/shared/metric-card';
import { formatKg } from '@/lib/formatters';
import type { InventarioResumen, Pedido, Producto } from '@/types/models';

export function DashboardKpis({
  orders,
  products,
  inventory
}: {
  orders: Pedido[];
  products: Producto[];
  inventory: InventarioResumen[];
}) {
  const pending = orders.filter((order) => order.estado === 'pendiente').length;
  const totalKg = orders.reduce((sum, order) => sum + Number(order.total_kg), 0);
  const activeProducts = products.filter((product) => product.activo).length;
  const lowStock = inventory.filter(
    (item) => Number(item.stock_actual) <= Number(item.stock_minimo)
  ).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <MetricCard title="Pedidos totales" value={orders.length} icon={ClipboardList} />
      <MetricCard
        title="Pendientes"
        value={pending}
        icon={PackageSearch}
        variant="warning"
      />
      <MetricCard
        title="Kg pedidos"
        value={formatKg(totalKg)}
        icon={Scale}
        variant="info"
      />
      <MetricCard
        title="Productos activos"
        value={activeProducts}
        icon={Boxes}
        variant="success"
      />
      <MetricCard
        title="Stock bajo"
        value={lowStock}
        icon={TriangleAlert}
        variant={lowStock ? 'warning' : 'success'}
      />
      <MetricCard
        title="WhatsApp"
        value="Preparado"
        icon={MessageCircle}
        description="Webhook manual listo"
      />
    </div>
  );
}
