import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;
import { clientesService } from '@/server/modules/clientes/clientes.service';
import { createClienteSchema } from '@/server/modules/clientes/clientes.schemas';

export const GET = rutaPrivada(async () => ok('Clientes obtenidos', await clientesService.findAll()));

export const POST = rutaPrivada(async (req) =>
  ok('Cliente creado', await clientesService.create(await leerCuerpo(req, createClienteSchema)), 201)
);
