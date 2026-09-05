import { listarPendientes } from '@/server/modules/whatsapp/whatsapp.handoff';
import { dinamico, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;

/**
 * Alimenta el badge del dashboard, que lo consulta cada 15 segundos. Devuelve
 * solo lo necesario para pintar la lista, no el hilo completo de cada chat.
 */
export const GET = ruta(async () => {
  const chats = await listarPendientes();
  return ok('Chats esperando a una persona', { total: chats.length, chats });
});
