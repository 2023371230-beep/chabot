import { DUPLICADO, supabase } from '../../database/supabase.client';
import { clasificar } from './whatsapp.intents';
import { enviarMensaje, marcarComoLeido } from './whatsapp.client';
import { Memoria } from './whatsapp.memoria';
import { MINUTOS_SILENCIO, silenciar } from './whatsapp.silencio';
import { decidir } from './whatsapp.router';
import { respuestaParaNoTexto } from './whatsapp.informacion';
import {
  esSoloEstados,
  extraerEcos,
  extraerMensajes,
  type Atencion,
  type EcoSaliente,
  type MensajeEntrante,
  type MetaWebhookPayload
} from './whatsapp.types';

/**
 * La puerta de entrada de WhatsApp.
 *
 * Este archivo solo hace transporte: recibe lo que manda Meta, lo guarda, se
 * asegura de no procesarlo dos veces, y devuelve la respuesta por el mismo
 * canal. NO decide nada de negocio — para eso llama a `decidir`.
 *
 * Antes esto y todo el negocio vivian juntos en 1400 lineas y 28 metodos.
 * Funcionaba, pero cualquier cambio obligaba a releerlo entero para saber si
 * se rompia algo lejano, y ahi es donde se cuelan los fallos caros. Ahora
 * cada pieza se lee sola:
 *
 *   whatsapp.intents.ts       que es este mensaje, sin gastar IA
 *   whatsapp.router.ts        a quien le toca atenderlo
 *   whatsapp.borrador.ts      del mensaje a una propuesta, nunca a un pedido
 *   whatsapp.pedido.ts        de la propuesta confirmada a un pedido real
 *   whatsapp.postventa.ts     cancelar, cambiar y consultar lo ya creado
 *   whatsapp.informacion.ts   precios, catalogo y horario desde la base
 *   whatsapp.handoff.ts       cuando toca callarse y llamar a una persona
 *
 * La dependencia va siempre en un solo sentido — servicio → router → los que
 * atienden → handoff — para que no haya ciclos: ninguna pieza puede llamar
 * hacia atras, que es como empieza el codigo del que ya nadie sabe el orden.
 */

type ResultadoMensaje = {
  wamid: string;
  telefono: string;
  procesado: boolean;
  motivo?: string;
  respuesta?: string;
  pedidoId?: string;
};

export async function procesarWebhook(payload: MetaWebhookPayload): Promise<ResultadoMensaje[]> {
  // Los acuses de entrega llegan por el mismo canal que los mensajes. Si se
  // trataran igual, el bot se responderia a si mismo en bucle.
  if (esSoloEstados(payload)) return [];

  // Los ecos van PRIMERO: si el dueño acaba de contestar desde su celular,
  // el bot tiene que callarse antes de tocar cualquier mensaje entrante que
  // venga en el mismo payload.
  for (const eco of extraerEcos(payload)) {
    await registrarEco(eco);
  }

  const mensajes = extraerMensajes(payload);
  const resultados: ResultadoMensaje[] = [];
  for (const mensaje of mensajes) {
    resultados.push(await procesarMensaje(mensaje));
  }
  return resultados;
}


export async function procesarMensaje(mensaje: MensajeEntrante): Promise<ResultadoMensaje> {
  const base = { wamid: mensaje.wamid, telefono: mensaje.telefono };

  if (!mensaje.telefono) {
    return { ...base, procesado: false, motivo: 'Mensaje sin telefono' };
  }

  // 1. Deduplicacion ANTES de procesar: la restriccion UNIQUE sobre
  //    wa_message_id es lo que corta los reintentos de Meta.
  const { data: guardado, error } = await supabase
    .from('mensajes_whatsapp')
    .insert({
      telefono: mensaje.telefono,
      mensaje: mensaje.texto || `[${mensaje.tipo}]`,
      tipo: 'cliente',
      wa_message_id: mensaje.wamid,
      procesado: false,
      payload: mensaje as unknown as Record<string, unknown>
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === DUPLICADO) {
      return { ...base, procesado: false, motivo: 'Mensaje duplicado' };
    }
    console.error('[whatsapp] no se pudo guardar:', error.message);
    return { ...base, procesado: false, motivo: 'Error al guardar' };
  }

  if (!mensaje.wamid.startsWith('test.')) {
    await marcarComoLeido(mensaje.wamid);
  }

  // Audios, fotos, videos, stickers y ubicaciones.
  //
  // Se contesta distinto segun lo que mandaron: un "no leo imagenes" a
  // quien mando una nota de voz suena a que ni se molestaron en mirar. Y
  // decir QUE hacer en su lugar es lo que evita que el cliente reenvie lo
  // mismo tres veces.
  if (mensaje.tipo !== 'text' || !mensaje.texto) {
    const r = respuestaParaNoTexto(mensaje.tipo);
    await responder(mensaje.telefono, r, guardado.id);
    return { ...base, procesado: true, motivo: `Tipo no soportado: ${mensaje.tipo}`, respuesta: r };
  }

  // 2. El flujo de negocio.
  const { respuesta, pedidoId } = await atender(
    mensaje.texto,
    mensaje.telefono,
    mensaje.nombrePerfil
  );

  // Respuesta vacia = decision deliberada de no contestar (un "👍" suelto).
  // Contestar cada emoji es ruido para el cliente y trabajo de mas.
  if (!respuesta) {
    await supabase.from('mensajes_whatsapp').update({ procesado: true }).eq('id', guardado.id);
    return { ...base, procesado: true, motivo: 'Sin respuesta necesaria' };
  }

  await responder(mensaje.telefono, respuesta, guardado.id);

  // El enlace se marca DESPUES de responder para que la confirmacion del bot
  // entre en la conversacion del pedido: es la ultima linea del hilo y la que
  // cierra el trato.
  if (pedidoId) await enlazarConversacion(pedidoId, mensaje.telefono);

  return { ...base, procesado: true, respuesta, pedidoId };
}


/**
 * Deja constancia de un posible pedido llegado a un chat en silencio.
 *
 * El bot no contesta — hay una persona al mando — pero un pedido que entra
 * mientras nadie mira es una venta perdida sin rastro. La marca aparece en
 * el hilo del dashboard, donde quien atiende el chat la va a ver.
 *
 * Solo se registra si el clasificador cree que hay intencion de compra: un
 * "gracias" en un chat callado no necesita alarma.
 */
export async function avisarIntentoEnChatCallado(texto: string, telefono: string): Promise<void> {
  if (clasificar(texto).tipo !== 'usar_ia') return;

  const { error } = await supabase.from('mensajes_whatsapp').insert({
    telefono,
    mensaje: '[ATENCION] Posible pedido recibido mientras el asistente estaba en pausa',
    tipo: 'sistema',
    procesado: false
  });

  if (error) console.error('[whatsapp] no se pudo marcar el intento:', error.message);
}


/**
 * Alguien contesto desde fuera de este sistema.
 *
 * Meta avisa con un "eco" cuando sale un mensaje del numero del negocio por
 * otra via — la app de WhatsApp Business en el celular del dueño, o el
 * Business Suite. Es la señal de que una persona ya esta atendiendo ese chat.
 *
 * En ese momento el bot se calla dos horas. Sin esto, el dueño escribe desde
 * su telefono, el cliente responde, y el bot le contesta encima: dos voces
 * distintas diciendo cosas distintas, que es justo lo que la funcion de
 * handoff existe para evitar.
 *
 * El mensaje se guarda como 'asesor' para que aparezca en el hilo del
 * dashboard. Si no, la conversacion tendria huecos inexplicables: el cliente
 * respondiendo a algo que en el historial nadie dijo.
 */
export async function registrarEco(eco: EcoSaliente): Promise<void> {
  await silenciar(eco.telefono, MINUTOS_SILENCIO.intervencion, false);

  const { error } = await supabase.from('mensajes_whatsapp').insert({
    telefono: eco.telefono,
    mensaje: eco.texto,
    tipo: 'asesor',
    wa_message_id: eco.wamid,
    procesado: true
  });

  // El UNIQUE sobre wa_message_id corta los reintentos de Meta: el eco de un
  // mensaje que ya se guardo no es un fallo.
  if (error && error.code !== DUPLICADO) {
    console.error('[whatsapp] no se pudo guardar el eco:', error.message);
  }
}


/**
 * Marca que estos mensajes fueron los que llevaron a este pedido.
 *
 * La regla no necesita ventanas de tiempo: se reclaman los mensajes de ese
 * telefono que aun no tengan dueño. Los pedidos anteriores ya reclamaron los
 * suyos, asi que lo que queda suelto es por definicion lo que llevo a este.
 * Un cliente que vuelve la semana siguiente estrena conversacion sin que su
 * pedido viejo pierda la que ya tenia.
 *
 * Va por una funcion de la base y no con un select+update desde aqui porque
 * dos mensajes del mismo cliente pueden procesarse a la vez en dos
 * instancias: un update atomico no deja la ventana en la que los dos
 * reclamarian los mismos mensajes.
 */
export async function enlazarConversacion(pedidoId: string, telefono: string): Promise<void> {
  const { error } = await supabase.rpc('asignar_conversacion_a_pedido', {
    p_pedido_id: pedidoId,
    p_telefono: telefono
  });

  // No se lanza: el pedido ya esta creado y el cliente ya recibio su
  // confirmacion. Quedarse sin el hilo es una perdida de contexto, no un
  // fallo de negocio.
  if (error) {
    console.error('[whatsapp] no se pudo enlazar la conversacion:', error.message);
  }
}


/**
 * Del texto del cliente a la respuesta.
 *
 * El orden importa: primero se descarta lo repetido, luego se clasifica sin
 * IA, y solo lo que de verdad necesita entenderse llega al modelo. La IA
 * SOLO extrae datos; los precios, el stock y el limite de mayoreo los
 * resuelve `pedidosService.createOrder`, la misma ruta que usa el dashboard,
 * para que las reglas no puedan contradecirse.
 */
export async function atender(texto: string, telefono: string, nombrePerfil?: string): Promise<Atencion> {
  // 0. La memoria se lee UNA vez por mensaje, y esa misma lectura dice si el
  //    chat esta pausado: no cuesta una consulta aparte.
  //
  //    Si una persona ya tomo el chat, el bot se calla. Contestar por debajo
  //    del asesor haria que el cliente vea dos voces distintas diciendo
  //    cosas distintas en la misma conversacion.
  const memoria = await Memoria.cargar(telefono);

  if (memoria.pausada) {
    // Callado no es sordo. Si el cliente escribe algo que parece un pedido
    // mientras una persona lleva el chat, se deja constancia para que no se
    // pierda una venta por estar el bot en silencio.
    await avisarIntentoEnChatCallado(texto, telefono);
    return { respuesta: '' };
  }

  const intencion = clasificar(texto);

  // 1. El cliente reenvio el mismo texto porque no vio la palomita. Se le
  //    repite lo que ya se le contesto en vez de procesarlo otra vez.
  //
  //    Pero la cache NO aplica a las respuestas cortas. "si", "no" y los
  //    numeros sueltos no dicen nada por si solos: contestan a la ultima
  //    pregunta, y la misma palabra significa cosas distintas en dos
  //    momentos distintos. Con la doble confirmacion todo pedido termina en
  //    un "si", asi que sin esta excepcion el segundo pedido de la tarde
  //    recibia el acuse del primero y no se creaba nunca.
  const esRespuesta =
    intencion.tipo === 'confirmacion' ||
    intencion.tipo === 'rechazo' ||
    intencion.tipo === 'solo_numero';

  if (!esRespuesta) {
    const yaContestado = memoria.respuestaRepetida(texto);
    if (yaContestado) return { respuesta: yaContestado };
  }

  const resultado = await decidir(intencion, texto, telefono, memoria, nombrePerfil);
  if (resultado.respuesta && !esRespuesta) {
    memoria.recordarRespuesta(texto, resultado.respuesta);
  }

  // Una sola escritura, y solo si algo cambio: un "buenos dias" no toca la base.
  await memoria.guardar();
  return resultado;
}


export async function responder(telefono: string, texto: string, mensajeOrigenId?: string): Promise<void> {
  const envio = await enviarMensaje(telefono, texto);

  // Las dos escrituras no dependen entre si: guardar lo que dijo el bot y
  // marcar como atendido el mensaje del cliente son hechos independientes.
  // En serie se pagaban dos viajes de red donde cabe uno.
  await Promise.all([
    supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: texto,
      tipo: 'bot',
      wa_message_id: envio.wamid ?? null,
      procesado: envio.enviado,
      error: envio.error ?? null
    }),
    mensajeOrigenId
      ? supabase.from('mensajes_whatsapp').update({ procesado: true }).eq('id', mensajeOrigenId)
      : Promise.resolve()
  ]);
}

/**
 * La superficie publica del modulo.
 *
 * Son tres metodos y llevan siendo tres desde el principio: el webhook, un
 * mensaje suelto (que usan la ruta de prueba y los scripts) y `atender`, que
 * es la logica sin el transporte. Se mantiene como objeto para no tocar a
 * quien ya lo llama asi.
 */
export const whatsappService = { procesarWebhook, procesarMensaje, atender };
