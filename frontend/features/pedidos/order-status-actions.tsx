'use client';

import { toast } from 'sonner';
import { IconCheck, IconProhibido } from '@/components/icons';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { endpoints } from '@/lib/api/endpoints';
import { formatKg } from '@/lib/formatters';
import type { Pedido, PedidoEstado } from '@/types/models';

/**
 * Confirmar es la unica accion que mueve inventario real, y en la practica es
 * irreversible: cancelar despues NO regresa el stock (verificado en
 * pedidos.service.ts, no hay logica de reversion). Por eso el boton nombra la
 * consecuencia y hay un dialogo de por medio.
 */
export function OrderStatusActions({
  order,
  onUpdated
}: {
  order: Pedido;
  onUpdated?: () => Promise<void> | void;
}) {
  const kg = formatKg(order.total_kg);

  const change = async (estado: PedidoEstado, exito: string) => {
    try {
      const result = await endpoints.pedidos.updateStatus(order.id, estado);
      toast.success(exito);
      result.warnings?.forEach((warning) => toast.warning(warning));
      await onUpdated?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'No se pudo cambiar el estado del pedido. Intenta de nuevo.'
      );
    }
  };

  const yaDescontado = order.estado === 'confirmado';

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {order.estado === 'pendiente' ? (
        <ConfirmDialog
          title="Confirmar y descontar stock"
          description={`Se van a descontar ${kg} del stock. Si te equivocas, cancelar el pedido no regresa el stock solo: tendrias que hacer un ajuste manual en Inventario.`}
          confirmLabel={`Si, descontar ${kg}`}
          variant="primary"
          onConfirm={() =>
            void change('confirmado', `Pedido confirmado. Se descontaron ${kg} del stock.`)
          }
          trigger={
            <Button variant="outline" size="sm">
              <IconCheck />
              Confirmar
            </Button>
          }
        />
      ) : null}

      {order.estado === 'confirmado' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void change('completado', 'Pedido marcado como entregado.')}
        >
          <IconCheck />
          Entregado
        </Button>
      ) : null}

      {order.estado !== 'cancelado' && order.estado !== 'completado' ? (
        <ConfirmDialog
          title="Cancelar pedido"
          description={
            yaDescontado
              ? `Este pedido ya estaba confirmado y sus ${kg} ya se descontaron del stock. Cancelarlo no los regresa automaticamente: hazlo con un movimiento de ajuste en Inventario si hace falta.`
              : 'Como este pedido no esta confirmado, cancelarlo no afecta tu stock.'
          }
          confirmLabel="Si, cancelar el pedido"
          cancelLabel="No, dejarlo asi"
          onConfirm={() => void change('cancelado', 'Pedido cancelado.')}
          trigger={
            <Button variant="danger" size="sm">
              <IconProhibido />
              Cancelar
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
