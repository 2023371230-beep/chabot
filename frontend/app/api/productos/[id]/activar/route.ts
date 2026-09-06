import { productosService } from '@/server/modules/productos/productos.service';
import { dinamico, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

export const PATCH = rutaPrivada(async (_req, { params }) =>
  ok('Producto activado', await productosService.setActive(params.id, true))
);
