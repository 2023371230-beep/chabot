import { supabase } from '../../database/supabase.client';

/**
 * Lectura de las conversaciones guardadas.
 *
 * Todo lo que hay aqui es de solo lectura: los mensajes los escribe el
 * servicio del bot al procesarlos. Este modulo existe para las dos pantallas
 * que los muestran — el detalle de un pedido y la bandeja de WhatsApp — y no
 * comparte codigo con el flujo de atencion a proposito: leer un historial y
 * atender un mensaje entrante no tienen nada en comun salvo la tabla.
 */

/** Un mensaje ya listo para pintarse como burbuja. */
export type MensajeChat = {
  id: string;
  /** `cliente` va a la izquierda, `bot` a la derecha, `sistema` al centro. */
  tipo: 'cliente' | 'bot' | 'sistema';
  texto: string;
  en: string;
  /** Presente solo en los del bot que no salieron. */
  error: string | null;
};

/** Una conversacion en la bandeja, sin el hilo completo. */
export type ConversacionResumen = {
  telefono: string;
  nombreCliente: string | null;
  clienteId: string | null;
  ultimoMensaje: string;
  ultimoEn: string;
  totalMensajes: number;
  /** true si el bot esta detenido en ese chat esperando a una persona. */
  pausada: boolean;
};

type FilaMensaje = {
  id: string;
  tipo: string;
  mensaje: string;
  created_at: string;
  error: string | null;
};

const aChat = (f: FilaMensaje): MensajeChat => ({
  id: f.id,
  tipo: (f.tipo === 'bot' || f.tipo === 'sistema' ? f.tipo : 'cliente') as MensajeChat['tipo'],
  texto: f.mensaje,
  en: f.created_at,
  error: f.error
});

/**
 * El hilo que produjo un pedido.
 *
 * Devuelve solo los mensajes marcados con ese pedido, en orden. Si el pedido
 * se capturo desde el panel no hay ninguno, y esa lista vacia es informacion:
 * la pantalla la usa para decir que lo capturo una persona en vez de dejar un
 * hueco sin explicar.
 */
export const conversacionDePedido = async (pedidoId: string): Promise<MensajeChat[]> => {
  const { data, error } = await supabase
    .from('mensajes_whatsapp')
    .select('id, tipo, mensaje, created_at, error')
    .eq('pedido_id', pedidoId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[conversaciones] no se pudo leer el hilo del pedido:', error.message);
    return [];
  }

  return (data ?? []).map(aChat);
};

/**
 * El hilo completo de un telefono.
 *
 * Aqui si va todo el historico, que es lo que se espera al abrir un chat en la
 * bandeja. Con tope, porque un cliente de dos años no cabe en una pantalla ni
 * hace falta: se muestran los ultimos y se sube para ver mas.
 */
export const conversacionDeTelefono = async (
  telefono: string,
  limite = 200
): Promise<MensajeChat[]> => {
  const { data, error } = await supabase
    .from('mensajes_whatsapp')
    .select('id, tipo, mensaje, created_at, error')
    .eq('telefono', telefono)
    .is('deleted_at', null)
    // Se piden los MAS NUEVOS y se invierten despues: pedir los mas viejos
    // con limite daria los primeros 200 de la historia, justo lo contrario de
    // lo que se quiere ver al abrir un chat.
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('[conversaciones] no se pudo leer el hilo:', error.message);
    return [];
  }

  return (data ?? []).map(aChat).reverse();
};

/**
 * La bandeja: una linea por telefono, ordenada por lo mas reciente.
 *
 * Se agrupa en memoria y no con SQL porque PostgREST no expone `group by`, y
 * montar una vista para esto ataria el esquema a una pantalla. Con el volumen
 * real — cientos de mensajes, no millones — recorrer una lista acotada es mas
 * simple y no se nota.
 */
export const listarConversaciones = async (limite = 500): Promise<ConversacionResumen[]> => {
  const { data, error } = await supabase
    .from('mensajes_whatsapp')
    .select('telefono, tipo, mensaje, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('[conversaciones] no se pudieron listar:', error.message);
    return [];
  }

  const porTelefono = new Map<string, ConversacionResumen>();

  for (const m of data ?? []) {
    const tel = m.telefono as string;
    let conv = porTelefono.get(tel);

    if (!conv) {
      // El primero que se ve es el mas reciente: los datos de cabecera salen
      // de ahi y no se vuelven a tocar.
      conv = {
        telefono: tel,
        nombreCliente: null,
        clienteId: null,
        ultimoMensaje: m.mensaje as string,
        ultimoEn: m.created_at as string,
        totalMensajes: 0,
        pausada: false
      };
      porTelefono.set(tel, conv);
    }

    conv.totalMensajes += 1;
  }

  const telefonos = [...porTelefono.keys()];
  if (!telefonos.length) return [];

  // Dos consultas mas, no una por conversacion: el nombre del cliente y si el
  // bot esta detenido ahi. En bloque, no en bucle.
  const [{ data: clientes }, { data: pausadas }] = await Promise.all([
    supabase.from('clientes').select('id, telefono, nombre').in('telefono', telefonos),
    supabase
      .from('conversaciones_whatsapp')
      .select('telefono')
      .eq('estado', 'escalado_humano')
      .is('deleted_at', null)
      .in('telefono', telefonos)
  ]);

  for (const c of clientes ?? []) {
    const conv = porTelefono.get(c.telefono as string);
    if (conv) {
      conv.nombreCliente = (c.nombre as string) ?? null;
      conv.clienteId = c.id as string;
    }
  }

  for (const p of pausadas ?? []) {
    const conv = porTelefono.get(p.telefono as string);
    if (conv) conv.pausada = true;
  }

  return [...porTelefono.values()].sort((a, b) => b.ultimoEn.localeCompare(a.ultimoEn));
};
