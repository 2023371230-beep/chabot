import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

import { aiService } from '@/server/modules/ai/ai.service';
import { extractOrderSchema } from '@/server/modules/ai/ai.schemas';

export const dynamic = dinamico;

export const POST = rutaPrivada(async (req) => {
  const { mensaje } = await leerCuerpo<{ mensaje: string }>(req, extractOrderSchema);
  return ok('Pedido extraido', await aiService.extractOrderFromMessage(mensaje));
});
