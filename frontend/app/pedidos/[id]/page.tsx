'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { Alert } from '@/components/ui/alert';
import { useApi } from '@/hooks/use-api';
import { endpoints } from '@/lib/api/endpoints';
import { OrderDetail } from '@/features/pedidos/order-detail';
import { OrderStatusActions } from '@/features/pedidos/order-status-actions';

export default function PedidoDetailPage() {
  const params = useParams<{ id: string }>();
  const order = useApi(() => endpoints.pedidos.get(params.id), [params.id]);

  if (order.loading) return <LoadingSkeleton />;
  if (order.error || !order.data)
    return <Alert>{order.error ?? 'Pedido no encontrado'}</Alert>;

  return (
    <>
      <PageHeader
        title="Detalle de pedido"
        description={`Pedido ${order.data.id}`}
        action={<OrderStatusActions order={order.data} onUpdated={order.refetch} />}
      />
      <OrderDetail order={order.data} />
    </>
  );
}
