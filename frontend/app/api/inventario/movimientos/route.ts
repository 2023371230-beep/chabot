import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { inventarioService } from '@/server/modules/inventario/inventario.service';
import { createInventarioMovimientoSchema } from '@/server/modules/inventario/inventario.schemas';

export const GET = ruta(async () =>
  ok('Movimientos obtenidos', await inventarioService.findMovimientos())
);

export const POST = ruta(async (req) =>
  ok(
    'Movimiento registrado',
    await inventarioService.createMovimiento(
      await leerCuerpo(req, createInventarioMovimientoSchema)
    ),
    201
  )
);
