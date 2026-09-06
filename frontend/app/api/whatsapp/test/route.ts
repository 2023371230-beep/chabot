import { dinamico, leerCuerpo, ok, rutaPrivada } from '@/server/http/route';

export const dynamic = dinamico;
import { whatsappService } from '@/server/modules/whatsapp/whatsapp.service';

/** Simulador para probar el flujo completo sin Meta de por medio. */
export const POST = rutaPrivada(async (req) => {
  const { telefono, mensaje } = await leerCuerpo<{ telefono?: string; mensaje?: string }>(req);
  const resultado = await whatsappService.procesarMensaje({
    wamid: `test.${Date.now()}`,
    telefono: telefono ?? '',
    texto: mensaje ?? '',
    tipo: 'text',
    recibidoEn: new Date()
  });
  return ok('Mensaje procesado', resultado);
});
