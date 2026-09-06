import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;
import { pedidosService } from '@/server/modules/pedidos/pedidos.service';
import { updatePedidoEstadoSchema } from '@/server/modules/pedidos/pedidos.schemas';

/**
 * Confirmar un pedido DESCUENTA STOCK REAL. Toda la validacion vive en
 * `updateOrderStatus`, que es la misma funcion que usa el bot de WhatsApp:
 * asi las reglas no pueden divergir entre el dashboard y el chat.
 */
export const PATCH = rutaPrivada(async (req, { params }) => {
  const { estado } = await leerCuerpo<{ estado: 'pendiente' | 'confirmado' | 'completado' | 'cancelado' }>(
    req,
    updatePedidoEstadoSchema
  );
  return ok('Estado actualizado', await pedidosService.updateOrderStatus(params.id, estado));
});
