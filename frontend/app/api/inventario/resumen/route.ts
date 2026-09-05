import { inventarioService } from '@/server/modules/inventario/inventario.service';
import { dinamico, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;

export const GET = ruta(async () =>
  ok('Resumen de inventario', await inventarioService.getResumen())
);
