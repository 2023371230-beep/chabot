import { listarConversaciones } from '@/server/modules/whatsapp/whatsapp.conversaciones';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

/** Una linea por telefono, de lo mas reciente a lo mas viejo. */
export const GET = rutaPrivada(async () =>
  ok('Conversaciones', await listarConversaciones())
);
