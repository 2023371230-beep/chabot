import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { productosService } from '@/server/modules/productos/productos.service';
import { updateProductoSchema } from '@/server/modules/productos/productos.schemas';

export const GET = ruta(async (_req, { params }) =>
  ok('Producto obtenido', await productosService.findById(params.id))
);

export const PATCH = ruta(async (req, { params }) =>
  ok(
    'Producto actualizado',
    await productosService.update(params.id, await leerCuerpo(req, updateProductoSchema))
  )
);
