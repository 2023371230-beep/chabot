import { inventarioService } from '@/server/modules/inventario/inventario.service';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

export const GET = rutaPrivada(async () =>
  ok('Resumen de inventario', await inventarioService.getResumen())
);
