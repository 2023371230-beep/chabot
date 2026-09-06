import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

import { inventarioService } from '@/server/modules/inventario/inventario.service';
import { createInventarioMovimientoSchema } from '@/server/modules/inventario/inventario.schemas';

export const dynamic = dinamico;

export const GET = rutaPrivada(async () =>
  ok('Movimientos obtenidos', await inventarioService.findMovimientos())
);

export const POST = rutaPrivada(async (req) =>
  ok(
    'Movimiento registrado',
    await inventarioService.createMovimiento(
      await leerCuerpo(req, createInventarioMovimientoSchema)
    ),
    201
  )
);
