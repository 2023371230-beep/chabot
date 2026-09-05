import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { env, isWhatsappWebhookConfigured } from '../../config/env';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { listarPendientes, reanudar } from './whatsapp.handoff';
import { whatsappService } from './whatsapp.service';
import type { MetaWebhookPayload } from './whatsapp.types';

/**
 * GET /api/whatsapp/webhook — verificacion de Meta.
 *
 * Meta pega aqui una sola vez, al guardar la URL del webhook en su panel.
 * Espera el `hub.challenge` devuelto tal cual, en TEXTO PLANO. Si se responde
 * el JSON envolvente del resto de la API, Meta rechaza el webhook.
 */
export const verificarWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!isWhatsappWebhookConfigured()) {
    console.error('[whatsapp] falta WHATSAPP_VERIFY_TOKEN en el .env');
    res.sendStatus(500);
    return;
  }

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    console.log('[whatsapp] webhook verificado por Meta');
    res.status(200).type('text/plain').send(String(challenge ?? ''));
    return;
  }

  console.warn('[whatsapp] verificacion rechazada: el token no coincide');
  res.sendStatus(403);
};

/**
 * Comprueba que el webhook viene de Meta y no de cualquiera que descubrio la
 * URL de ngrok.
 *
 * Meta firma el cuerpo crudo con el App Secret. La comparacion va con
 * `timingSafeEqual` para no filtrar informacion por el tiempo que tarda.
 *
 * Sin `WHATSAPP_APP_SECRET` configurado no se puede verificar; se deja pasar
 * pero se avisa, porque bloquear dejaria el webhook inservible en desarrollo.
 */
const firmaValida = (req: Request): boolean => {
  const secret = env.whatsapp.appSecret;
  if (!secret) {
    console.warn(
      '[whatsapp] sin WHATSAPP_APP_SECRET: no se verifica la firma del webhook'
    );
    return true;
  }

  const firma = req.header('x-hub-signature-256');
  const crudo = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!firma || !crudo) return false;

  const esperada =
    'sha256=' + crypto.createHmac('sha256', secret).update(crudo).digest('hex');

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * POST /api/whatsapp/webhook — mensajes entrantes.
 *
 * Regla de oro: responder 200 ANTES de procesar.
 *
 * Meta espera el acuse en pocos segundos. Si tarda o responde otra cosa,
 * reintenta el mismo mensaje varias veces, y cada reintento crearia el pedido
 * de nuevo. Por eso:
 *   1. se responde 200 de inmediato
 *   2. el trabajo real corre en `setImmediate`, ya fuera del ciclo de respuesta
 *   3. la deduplicacion por `wa_message_id` UNIQUE atrapa cualquier reintento
 *      que se cuele igual
 *
 * Tampoco se valida el cuerpo con Zod antes de responder: un payload que no
 * cuadre con el esquema devolveria 400 y Meta lo reintentaria en bucle.
 */
export const recibirWebhook = (req: Request, res: Response): void => {
  if (!firmaValida(req)) {
    console.warn('[whatsapp] firma invalida, se descarta el webhook');
    res.sendStatus(401);
    return;
  }

  // 1. Meta se va contento de inmediato.
  res.sendStatus(200);

  // 2. El trabajo pesado ocurre despues de responder.
  const payload = req.body as MetaWebhookPayload;
  setImmediate(() => {
    whatsappService.procesarWebhook(payload).catch((error: unknown) => {
      console.error(
        '[whatsapp] fallo procesando el webhook:',
        error instanceof Error ? error.message : error
      );
    });
  });
};

/**
 * POST /api/whatsapp/test — simulador para probar sin Meta de por medio.
 * Recibe { telefono, mensaje } y corre el mismo flujo que un mensaje real.
 */
export const probarMensaje = asyncHandler(async (req: Request, res: Response) => {
  const { telefono, mensaje } = req.body as { telefono?: string; mensaje?: string };
  const resultado = await whatsappService.procesarMensaje({
    wamid: `test.${Date.now()}`,
    telefono: telefono ?? '',
    texto: mensaje ?? '',
    tipo: 'text',
    recibidoEn: new Date()
  });
  sendSuccess(res, 'Mensaje procesado', resultado);
});

/**
 * GET /api/whatsapp/handoffs — los chats esperando a una persona.
 *
 * Es lo que alimenta el badge del dashboard. Se consulta seguido, asi que
 * devuelve solo lo necesario para pintar la lista, no el hilo completo.
 */
export const listarHandoffs = asyncHandler(async (_req: Request, res: Response) => {
  const pendientes = await listarPendientes();
  sendSuccess(res, 'Chats esperando a una persona', {
    total: pendientes.length,
    chats: pendientes
  });
});

/**
 * POST /api/whatsapp/handoffs/:telefono/reanudar — devuelve el chat al bot.
 *
 * Se llama cuando el asesor ya resolvio lo que el bot no podia.
 */
export const reanudarHandoff = asyncHandler(async (req: Request, res: Response) => {
  const telefono = String(req.params.telefono ?? '');
  const ok = await reanudar(telefono);
  sendSuccess(res, ok ? 'El asistente vuelve a atender este chat' : 'No habia nada que reanudar', {
    telefono,
    reanudado: ok
  });
});
