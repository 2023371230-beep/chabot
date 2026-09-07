'use client';

import { useParams } from 'next/navigation';
import { PageShell } from '@/client/components/layout/page-shell';
import { ErrorState } from '@/client/components/shared/error-state';
import { LoadingSkeleton } from '@/client/components/shared/loading-skeleton';
import { useApi } from '@/client/hooks/use-api';
import { endpoints } from '@/client/lib/api/endpoints';
import { OrderDetail } from '@/client/features/pedidos/order-detail';
import { OrderStatusActions } from '@/client/features/pedidos/order-status-actions';

/**
 * El detalle de un pedido.
 *
 * Usa `PageShell` como las demas pantallas, y no una cabecera propia. Antes
 * era la unica que no lo hacia, y eso costaba tres cosas que se veian a
 * simple vista: el contenido nacia pegado a los dos bordes de la pantalla —
 * los marcos de las tarjetas se apoyaban en el borde y parecian cortados —,
 * la pagina scrolleaba distinto que el resto, y el titulo caia a otra altura
 * al llegar aqui desde la lista.
 *
 * La cabecera se pinta SIEMPRE, tambien mientras carga y cuando falla: asi el
 * titulo y el boton de volver no aparecen y desaparecen, que es lo que hace
 * que una pantalla se sienta inestable.
 */
export default function PedidoDetailPage() {
  const params = useParams<{ id: string }>();
  const order = useApi(() => endpoints.pedidos.get(params.id), [params.id], `pedido:${params.id}`);

  return (
    <PageShell
      title="Detalle de pedido"
      description={`Pedido ${params.id}`}
      action={
        order.data ? <OrderStatusActions order={order.data} onUpdated={order.refetch} /> : undefined
      }
    >
      {order.loading ? (
        <LoadingSkeleton />
      ) : order.error || !order.data ? (
        <ErrorState
          title="No se pudo cargar el pedido"
          description={order.error ?? 'Pedido no encontrado'}
          onRetry={order.refetch}
        />
      ) : (
        <OrderDetail order={order.data} />
      )}
    </PageShell>
  );
}
