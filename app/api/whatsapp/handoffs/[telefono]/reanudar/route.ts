import { reanudar } from '@/server/modules/whatsapp/whatsapp.handoff';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

export const POST = rutaPrivada(async (_req, { params }) => {
  const telefono = decodeURIComponent(params.telefono);
  const reanudado = await reanudar(telefono);
  return ok(
    reanudado ? 'El asistente vuelve a atender este chat' : 'No habia nada que reanudar',
    { telefono, reanudado }
  );
});
