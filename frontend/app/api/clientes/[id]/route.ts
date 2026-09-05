import { dinamico, leerCuerpo, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;
import { clientesService } from '@/server/modules/clientes/clientes.service';
import { updateClienteSchema } from '@/server/modules/clientes/clientes.schemas';

export const GET = ruta(async (_req, { params }) =>
  ok('Cliente obtenido', await clientesService.findById(params.id))
);

export const PATCH = ruta(async (req, { params }) =>
  ok(
    'Cliente actualizado',
    await clientesService.update(params.id, await leerCuerpo(req, updateClienteSchema))
  )
);
