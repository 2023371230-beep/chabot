import { supabase } from '../../database/supabase.client';

/**
 * Cuando el bot debe callarse, y por cuánto.
 *
 * EL PROBLEMA
 *
 * El bot solo se callaba cuando EL decidia escalar. Si el dueño agarraba su
 * celular y le contestaba al cliente, el bot no se enteraba y seguia
 * respondiendo: dos voces distintas en el mismo chat, y el cliente sin saber a
 * quien le habla.
 *
 * DOS COSAS QUE PARECEN UNA
 *
 * "El bot esta callado" y "este chat necesita a una persona" no son lo mismo,
 * y mezclarlas rompe una de las dos:
 *
 *   · Si el silencio no caduca, el dueño interviene una vez, se le olvida
 *     reactivar, y el cliente se queda mudo para siempre. Se pierden ventas
 *     sin que nadie se entere.
 *
 *   · Si la bandeja se limpiara sola al despertar el bot, un reclamo
 *     desapareceria de la lista sin que nadie lo haya atendido.
 *
 * Por eso van separadas: el silencio caduca, la bandeja no. Un reclamo calla
 * al bot 12 horas y ademas entra en la bandeja; pasadas esas horas el bot
 * vuelve a tomar pedidos — mejor eso que silencio eterno — pero el chat sigue
 * en la lista hasta que alguien lo resuelva.
 *
 * Con caducidad no hace falta ningun proceso nocturno de limpieza: el silencio
 * se acaba solo al leerlo.
 */

/** Cuanto calla cada situacion. */
export const MINUTOS_SILENCIO = {
  /**
   * El dueño escribio desde el panel o desde su celular.
   *
   * Dos horas: lo que dura razonablemente una conversacion humana. Si el
   * cliente vuelve al dia siguiente con un pedido nuevo, el bot ya esta
   * despierto y no se pierde la venta.
   */
  intervencion: 120,

  /**
   * El bot escalo por su cuenta (queja, regateo, sin stock).
   *
   * Doce horas: son casos que requieren que alguien conteste de verdad, y
   * despertar al bot a la media hora seria pisarle la conversacion a quien
   * este atendiendo.
   */
  handoff: 720
} as const;

/**
 * Calla al bot en un chat.
 *
 * `necesitaPersona` decide si ademas entra en la bandeja de pendientes. Al
 * responder desde el panel NO se marca: el dueño ya esta atendiendo, meterlo
 * en la lista de "pendientes de atender" seria ruido.
 */
export const silenciar = async (
  telefono: string,
  minutos: number,
  necesitaPersona = false
): Promise<void> => {
  const { error } = await supabase.rpc('silenciar_bot', {
    p_telefono: telefono,
    p_minutos: minutos,
    p_necesita_persona: necesitaPersona
  });

  if (error) {
    console.error('[silencio] no se pudo silenciar el bot:', error.message);
  }
};

/** Devuelve el chat al bot y lo saca de la bandeja. */
export const reactivar = async (telefono: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('reactivar_bot', { p_telefono: telefono });

  if (error) {
    console.error('[silencio] no se pudo reactivar el bot:', error.message);
    return false;
  }
  return Boolean(data);
};

/**
 * El mensaje que cierra la intervencion del bot.
 *
 * No lleva nombres. El cliente no tiene por que saber quien de la empresa le
 * va a contestar, y poner un nombre concreto obliga a mantenerlo cuando esa
 * persona ya no este.
 */
export const AVISO_TOMA_UNA_PERSONA =
  'He pausado mis respuestas automaticas en este chat. En unos minutos le atiende un asesor personalmente.';
