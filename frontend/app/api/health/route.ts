import { estadoPresupuesto } from '@/server/modules/whatsapp/whatsapp.presupuesto';
import { dinamico, limitarPorIP, ok, ruta } from '@/server/http/route';

export const dynamic = dinamico;

/**
 * Ademas de decir que el servidor vive, expone la cuota de IA que queda: es el
 * unico recurso que se agota solo, sin avisar, hasta que el bot deja de tomar
 * pedidos.
 */
/**
 * Queda ABIERTA a proposito: es lo que consulta el indicador "En linea" del
 * navbar antes de que exista sesion, y un monitor externo no puede iniciar
 * sesion para preguntar si el servidor vive.
 *
 * Por eso lleva cuota por IP y no expone nada sensible: solo la hora y cuanta
 * cuota de IA queda, que no dice nada de los clientes ni de las ventas.
 */
export const GET = ruta(async (req) => {
  const frenado = limitarPorIP(req, 'health', { maximo: 60, ventanaMs: 60_000 });
  if (frenado) return frenado;

  return ok('Backend running', {
    timestamp: new Date().toISOString(),
    ia: await estadoPresupuesto()
  });
});
