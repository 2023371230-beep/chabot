import { conversacionDeTelefono } from '@/server/modules/whatsapp/whatsapp.conversaciones';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

/** El hilo completo de un telefono, del mas viejo al mas nuevo. */
export const GET = rutaPrivada(async (_req, { params }) =>
  ok('Conversacion', await conversacionDeTelefono(decodeURIComponent(params.telefono)))
);
