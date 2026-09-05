import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { pedidosService } from '@/server/modules/pedidos/pedidos.service';
import { createPedidoSchema } from '@/server/modules/pedidos/pedidos.schemas';

export const GET = ruta(async () => ok('Pedidos obtenidos', await pedidosService.findAll()));

export const POST = ruta(async (req) =>
  ok('Pedido creado', await pedidosService.createOrder(await leerCuerpo(req, createPedidoSchema)), 201)
);
