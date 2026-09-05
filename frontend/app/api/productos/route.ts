import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { productosService } from '@/server/modules/productos/productos.service';
import { createProductoSchema } from '@/server/modules/productos/productos.schemas';

export const GET = ruta(async () => ok('Productos obtenidos', await productosService.findAll()));

export const POST = ruta(async (req) =>
  ok('Producto creado', await productosService.create(await leerCuerpo(req, createProductoSchema)), 201)
);
