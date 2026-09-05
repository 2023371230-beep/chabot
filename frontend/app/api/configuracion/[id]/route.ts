import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { configuracionService } from '@/server/modules/configuracion/configuracion.service';
import { updateConfiguracionSchema } from '@/server/modules/configuracion/configuracion.schemas';

export const PATCH = ruta(async (req, { params }) =>
  ok(
    'Configuracion actualizada',
    await configuracionService.update(params.id, await leerCuerpo(req, updateConfiguracionSchema))
  )
);
