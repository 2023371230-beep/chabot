'use client';

import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { useApi } from '@/hooks/use-api';
import { endpoints } from '@/lib/api/endpoints';
import { OrderDetail } from '@/features/pedidos/order-detail';
import { OrderStatusActions } from '@/features/pedidos/order-status-actions';

export default function PedidoDetailPage() {
  const params = useParams<{ id: string }>();
  const order = useApi(() => endpoints.pedidos.get(params.id), [params.id], `pedido:${params.id}`);

  if (order.loading) return <LoadingSkeleton />;
  if (order.error || !order.data)
    return (
      <ErrorState
        title="No se pudo cargar el pedido"
        description={order.error ?? 'Pedido no encontrado'}
        onRetry={order.refetch}
      />
    );

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
