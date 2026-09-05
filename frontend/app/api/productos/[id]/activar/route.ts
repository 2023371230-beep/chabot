import { productosService } from '@/server/modules/productos/productos.service';
import { dinamico, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;

export const PATCH = ruta(async (_req, { params }) =>
  ok('Producto activado', await productosService.setActive(params.id, true))
);
