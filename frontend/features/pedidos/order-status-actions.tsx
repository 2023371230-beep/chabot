'use client';

import { CheckCircle2, CircleSlash, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import type { Pedido, PedidoEstado } from '@/types/models';

export function OrderStatusActions({
  order,
  onUpdated
}: {
  order: Pedido;
  onUpdated?: () => Promise<void> | void;
}) {
  const change = async (estado: PedidoEstado) => {
    try {
      const result = await endpoints.pedidos.updateStatus(order.id, estado);
      toast.success('Estado actualizado');
      result.warnings?.forEach((warning) => toast.warning(warning));
      await onUpdated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar estado');
    }
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {order.estado === 'pendiente' ? (
        <Button variant="outline" size="sm" onClick={() => change('confirmado')}>
          <CheckCircle2 className="h-4 w-4" />
          Confirmar
        </Button>
      ) : null}
      {order.estado === 'confirmado' ? (
        <Button variant="outline" size="sm" onClick={() => change('completado')}>
          <PackageCheck className="h-4 w-4" />
          Completar
        </Button>
      ) : null}
      {order.estado !== 'cancelado' && order.estado !== 'completado' ? (
        <Button variant="danger" size="sm" onClick={() => change('cancelado')}>
          <CircleSlash className="h-4 w-4" />
          Cancelar
        </Button>
      ) : null}
    </div>
  );
}
