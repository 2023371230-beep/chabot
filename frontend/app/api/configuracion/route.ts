import { configuracionService } from '@/server/modules/configuracion/configuracion.service';
import { dinamico, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;

export const GET = ruta(async () =>
  ok('Configuracion obtenida', await configuracionService.getCurrent())
);
