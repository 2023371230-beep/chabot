import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;
import { pedidosService } from '@/server/modules/pedidos/pedidos.service';
import { updatePedidoSchema } from '@/server/modules/pedidos/pedidos.schemas';

export const GET = rutaPrivada(async (_req, { params }) =>
  ok('Pedido obtenido', await pedidosService.findById(params.id))
);

export const PATCH = rutaPrivada(async (req, { params }) =>
  ok(
    'Pedido actualizado',
    await pedidosService.updateOrder(params.id, await leerCuerpo(req, updatePedidoSchema))
  )
);
