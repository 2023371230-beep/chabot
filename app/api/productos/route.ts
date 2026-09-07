import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

import { productosService } from '@/server/modules/productos/productos.service';
import { createProductoSchema } from '@/server/modules/productos/productos.schemas';

export const dynamic = dinamico;

export const GET = rutaPrivada(async () => ok('Productos obtenidos', await productosService.findAll()));

export const POST = rutaPrivada(async (req) =>
  ok('Producto creado', await productosService.create(await leerCuerpo(req, createProductoSchema)), 201)
);
