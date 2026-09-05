import { estadoPresupuesto } from '@/server/modules/whatsapp/whatsapp.presupuesto';
import { dinamico, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;

/**
 * Ademas de decir que el servidor vive, expone la cuota de IA que queda: es el
 * unico recurso que se agota solo, sin avisar, hasta que el bot deja de tomar
 * pedidos.
 */
export const GET = ruta(async () =>
  ok('Backend running', {
    timestamp: new Date().toISOString(),
    ia: await estadoPresupuesto()
  })
);
