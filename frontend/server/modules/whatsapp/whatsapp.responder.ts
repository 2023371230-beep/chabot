import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';
import { enviarMensaje } from './whatsapp.client';
import { MINUTOS_SILENCIO, silenciar } from './whatsapp.silencio';
import type { MensajeChat } from './whatsapp.conversaciones';

/**
 * Responderle a un cliente desde el panel.
 *
 * Cierra el circulo del handoff: hasta ahora el dashboard avisaba "este chat
 * necesita a una persona" y ahi lo dejaba — habia que salir a WhatsApp Web
 * para contestar, y al volver el bot ya habia dicho otra cosa.
 *
 * Hace tres cosas en orden, y el orden importa:
 *
 *   1. CALLA AL BOT primero. Si se enviara antes de silenciar, la respuesta
 *      del cliente podria entrar por el webhook en ese hueco y el bot le
 *      contestaria encima al asesor.
 *   2. Manda el mensaje por la Cloud API.
 *   3. Lo guarda como 'asesor', no como 'bot'.
 *
 * Ese tercer punto no es cosmetico: si se guardara como 'bot', al revisar por
 * que un cliente se molesto no habria forma de saber que dijo el asistente y
 * que dijo una persona.
 */

/** Meta rechaza texto libre fuera de la ventana de 24 h con este codigo. */
const FUERA_DE_VENTANA = '131047';

export const responderComoAsesor = async (
  telefono: string,
  texto: string
): Promise<MensajeChat> => {
  const limpio = texto.trim();
  if (!limpio) throw new AppError('El mensaje esta vacio', 400);

  // 1. Silencio ANTES de enviar. No marca el chat como pendiente: quien
  //    escribe ya lo esta atendiendo, meterlo en la bandeja seria ruido.
  await silenciar(telefono, MINUTOS_SILENCIO.intervencion, false);

  // 2. Envio.
  const envio = await enviarMensaje(telefono, limpio);

  if (!envio.enviado) {
    const detalle = envio.error ?? '';

    // La ventana de 24 h merece su propio mensaje: es una regla de Meta, no un
    // fallo, y quien escribe necesita saber que no puede arreglarlo
    // reintentando.
    if (detalle.includes(FUERA_DE_VENTANA) || /24 hours|re-engagement/i.test(detalle)) {
      throw new AppError(
        'Este cliente no ha escrito en las ultimas 24 horas. WhatsApp solo permite responder dentro de esa ventana; para reabrir la conversacion hace falta una plantilla aprobada por Meta.',
        409
      );
    }

    throw new AppError(`No se pudo enviar: ${detalle || 'error desconocido'}`, 502);
  }

  // 3. Se guarda ya enviado.
  const { data, error } = await supabase
    .from('mensajes_whatsapp')
    .insert({
      telefono,
      mensaje: limpio,
      tipo: 'asesor',
      wa_message_id: envio.wamid ?? null,
      procesado: true
    })
    .select('id, tipo, mensaje, created_at, error')
    .single();

  if (error || !data) {
    // El mensaje YA salio. Que no se haya podido guardar el registro no se le
    // puede ocultar a quien escribio: creeria que no se envio y lo repetiria.
    console.error('[responder] enviado pero no guardado:', error?.message);
    return {
      id: envio.wamid ?? `sin-guardar-${Date.now()}`,
      tipo: 'asesor',
      texto: limpio,
      en: new Date().toISOString(),
      error: 'Se envio, pero no se pudo guardar en el historial'
    };
  }

  return {
    id: data.id as string,
    tipo: 'asesor',
    texto: data.mensaje as string,
    en: data.created_at as string,
    error: null
  };
};

/**
 * Cuando el cliente escribio por ultima vez.
 *
 * Sirve para decirle a quien va a escribir si la ventana de 24 h sigue abierta
 * ANTES de que redacte el mensaje. Enterarse despues de escribir un parrafo es
 * la peor forma de descubrir una limitacion.
 */
export const ultimoMensajeDelCliente = async (telefono: string): Promise<string | null> => {
  const { data } = await supabase
    .from('mensajes_whatsapp')
    .select('created_at')
    .eq('telefono', telefono)
    .eq('tipo', 'cliente')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.created_at as string) ?? null;
};
