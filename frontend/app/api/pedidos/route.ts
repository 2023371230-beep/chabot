import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;
import { pedidosService } from '@/server/modules/pedidos/pedidos.service';
import { createPedidoSchema } from '@/server/modules/pedidos/pedidos.schemas';

export const GET = rutaPrivada(async () => ok('Pedidos obtenidos', await pedidosService.findAll()));

export const POST = rutaPrivada(async (req) =>
  ok('Pedido creado', await pedidosService.createOrder(await leerCuerpo(req, createPedidoSchema)), 201)
);
