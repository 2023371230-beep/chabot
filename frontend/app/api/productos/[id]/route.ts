import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

import { productosService } from '@/server/modules/productos/productos.service';
import { updateProductoSchema } from '@/server/modules/productos/productos.schemas';

export const dynamic = dinamico;

export const GET = rutaPrivada(async (_req, { params }) =>
  ok('Producto obtenido', await productosService.findById(params.id))
);

export const PATCH = rutaPrivada(async (req, { params }) =>
  ok(
    'Producto actualizado',
    await productosService.update(params.id, await leerCuerpo(req, updateProductoSchema))
  )
);
