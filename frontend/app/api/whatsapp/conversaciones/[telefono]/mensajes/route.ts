import { z } from 'zod';
import { responderComoAsesor } from '@/server/modules/whatsapp/whatsapp.responder';
import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;

const esquema = z.object({
  texto: z.string().trim().min(1, 'El mensaje esta vacio').max(4000)
});

/**
 * Responderle al cliente desde el panel.
 *
 * Calla al bot dos horas ANTES de enviar, para que la respuesta del cliente no
 * caiga en el hueco entre el envio y el silencio y acabe contestada por el
 * asistente encima del asesor.
 */
export const POST = rutaPrivada(async (req, { params }) => {
  const { texto } = await leerCuerpo<{ texto: string }>(req, esquema);
  const telefono = decodeURIComponent(params.telefono);
  return ok('Mensaje enviado', await responderComoAsesor(telefono, texto));
});
