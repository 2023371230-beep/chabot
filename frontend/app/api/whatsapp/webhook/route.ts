import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { env, isWhatsappWebhookConfigured } from '@/server/config/env';
import { whatsappService } from '@/server/modules/whatsapp/whatsapp.service';
import { limitarPorIP } from '@/server/http/route';
import type { MetaWebhookPayload } from '@/server/modules/whatsapp/whatsapp.types';

/**
 * El webhook de WhatsApp.
 *
 * Es la unica ruta que NO usa el sobre `{ success, message, data }` del resto
 * de la API: Meta espera respuestas suyas y cualquier otra cosa hace que
 * rechace el webhook o entre en un bucle de reintentos.
 */

// Sin esto Next podria cachear la respuesta del webhook, que es justo lo peor
// que puede pasarle a un endpoint que recibe mensajes distintos cada vez.
export const dynamic = 'force-dynamic';

// El webhook usa `crypto` de Node y habla con Supabase y Groq: necesita el
// runtime de Node, no el Edge.
export const runtime = 'nodejs';

/**
 * Vercel corta las funciones a los 10 segundos por defecto.
 *
 * El caso normal son milisegundos y el peor caso (extraccion con IA) ronda
 * 1.5 s, pero si Groq tiene un mal dia el corte llegaria a mitad de crear un
 * pedido. Treinta segundos dan margen de sobra sin dejar la funcion colgada.
 */
export const maxDuration = 30;

/**
 * GET — verificacion de Meta.
 *
 * Meta pega aqui una sola vez, al guardar la URL del webhook en su panel.
 * Espera el `hub.challenge` devuelto tal cual, en TEXTO PLANO. Si se responde
 * el JSON envolvente del resto de la API, Meta rechaza el webhook.
 */
export function GET(req: Request): NextResponse {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (!isWhatsappWebhookConfigured()) {
    console.error('[whatsapp] falta WHATSAPP_VERIFY_TOKEN en las variables de entorno');
    return new NextResponse(null, { status: 500 });
  }

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    console.log('[whatsapp] webhook verificado por Meta');
    return new NextResponse(challenge ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  console.warn('[whatsapp] verificacion rechazada: el token no coincide');
  return new NextResponse(null, { status: 403 });
}

/**
 * Comprueba que el webhook viene de Meta y no de cualquiera que descubrio la
 * URL publica.
 *
 * Meta firma el cuerpo CRUDO con el App Secret. Hay que trabajar sobre los
 * bytes exactos que llegaron: si se parsea el JSON y se vuelve a serializar,
 * cualquier diferencia de espacios u orden de llaves cambia el hash y la
 * firma deja de coincidir.
 *
 * La comparacion va con `timingSafeEqual` para no filtrar informacion por el
 * tiempo que tarda en fallar.
 */
const firmaValida = (crudo: string, firma: string | null): boolean => {
  const secret = env.whatsapp.appSecret;
  if (!secret) {
    console.warn('[whatsapp] sin WHATSAPP_APP_SECRET: no se verifica la firma del webhook');
    return true;
  }

  if (!firma) return false;

  const esperada =
    'sha256=' + crypto.createHmac('sha256', secret).update(crudo, 'utf8').digest('hex');

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * POST — mensajes entrantes.
 *
 * POR QUE AQUI SE PROCESA ANTES DE RESPONDER, Y EN EXPRESS ERA AL REVES
 *
 * En Express se respondia 200 de inmediato y el trabajo iba en un
 * `setImmediate`, porque el proceso sigue vivo despues de responder. En
 * serverless no: en cuanto se devuelve la respuesta, la funcion se congela y
 * el trabajo pendiente puede no ejecutarse nunca. Un pedido se perderia sin
 * dejar rastro, que es el peor fallo posible — silencioso.
 *
 * Asi que aqui se espera. Es seguro porque:
 *   - el 80% de los mensajes se resuelven con reglas, en milisegundos
 *   - los que llegan a la IA tardan ~1.5 s, muy dentro de lo que Meta tolera
 *   - y si Meta llegara a reintentar por lentitud, el `UNIQUE` sobre
 *     `wa_message_id` hace que el reintento no duplique nada
 *
 * La ultima es la que permite dormir tranquilo: los reintentos son inofensivos.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // Cuota antes de leer el cuerpo y antes de calcular el HMAC.
  //
  // Meta manda como mucho unos pocos mensajes por segundo incluso en una hora
  // punta; 120 por minuto es holgado. Lo que corta es a quien descubre la URL
  // y la inunda: verificar una firma cuesta CPU, y sin este limite se pagaria
  // ese calculo por cada peticion basura.
  const frenado = limitarPorIP(req, 'webhook', { maximo: 120, ventanaMs: 60_000 });
  if (frenado) return frenado;

  const crudo = await req.text();

  // Tope de tamaño. El limite de 8000 tokens/minuto de Groq ya esta cubierto
  // por el recorte del mensaje, pero un cuerpo de varios megas consume memoria
  // y tiempo de funcion antes de llegar a ese recorte.
  if (crudo.length > 128_000) {
    console.warn('[whatsapp] cuerpo demasiado grande, se descarta');
    return new NextResponse(null, { status: 200 });
  }

  if (!firmaValida(crudo, req.headers.get('x-hub-signature-256'))) {
    console.warn('[whatsapp] firma invalida: se rechaza el webhook');
    return new NextResponse(null, { status: 401 });
  }

  try {
    const payload = JSON.parse(crudo) as MetaWebhookPayload;
    await whatsappService.procesarWebhook(payload);
  } catch (error) {
    // Se registra pero se responde 200 igual. Un 4xx o 5xx hace que Meta
    // reintente el MISMO mensaje una y otra vez, y si el fallo es del servidor el
    // reintento va a fallar igual: seria un bucle infinito sin ganar nada.
    console.error(
      '[whatsapp] fallo procesando el webhook:',
      error instanceof Error ? error.message : error
    );
  }

  return new NextResponse(null, { status: 200 });
}
