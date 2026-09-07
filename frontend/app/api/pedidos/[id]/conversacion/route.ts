import { conversacionDePedido } from '@/server/modules/whatsapp/whatsapp.conversaciones';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

/**
 * El hilo de WhatsApp que produjo este pedido.
 *
 * Una lista vacia NO es un error: significa que el pedido se capturo desde el
 * panel. La pantalla lo distingue y lo dice, en vez de dejar un hueco.
 */
export const GET = rutaPrivada(async (_req, { params }) =>
  ok('Conversacion del pedido', await conversacionDePedido(params.id))
);
