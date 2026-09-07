import { configuracionService } from '@/server/modules/configuracion/configuracion.service';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

export const GET = rutaPrivada(async () =>
  ok('Configuracion obtenida', await configuracionService.getCurrent())
);
