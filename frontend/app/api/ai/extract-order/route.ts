import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { aiService } from '@/server/modules/ai/ai.service';
import { extractOrderSchema } from '@/server/modules/ai/ai.schemas';

export const POST = ruta(async (req) => {
  const { mensaje } = await leerCuerpo<{ mensaje: string }>(req, extractOrderSchema);
  return ok('Pedido extraido', await aiService.extractOrderFromMessage(mensaje));
});
