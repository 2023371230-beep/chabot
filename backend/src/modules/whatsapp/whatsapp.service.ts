import { supabase } from '../../database/supabase.client';
import { enviarMensaje, marcarComoLeido } from './whatsapp.client';
import {
  esSoloEstados,
  extraerMensajes,
  type MensajeEntrante,
  type MetaWebhookPayload
} from './whatsapp.types';

/** Codigo de PostgreSQL para violacion de restriccion unica. */
const DUPLICADO = '23505';

type ResultadoMensaje = {
  wamid: string;
  telefono: string;
  procesado: boolean;
  motivo?: string;
  respuesta?: string;
};

export const whatsappService = {
  /**
   * Entrada del webhook. Un solo POST de Meta puede traer varios mensajes.
   */
  async procesarWebhook(payload: MetaWebhookPayload): Promise<ResultadoMensaje[]> {
    // Los acuses de entrega (sent/delivered/read) llegan por el mismo canal.
    // Si se trataran como mensajes entrantes, el bot se responderia solo.
    if (esSoloEstados(payload)) return [];

    const mensajes = extraerMensajes(payload);
    if (!mensajes.length) return [];

    const resultados: ResultadoMensaje[] = [];
    for (const mensaje of mensajes) {
      resultados.push(await this.procesarMensaje(mensaje));
    }
    return resultados;
  },

  /**
   * Procesa UN mensaje.
   *
   * El insert va primero a proposito: la restriccion UNIQUE sobre
   * `wa_message_id` es la que corta los reintentos de Meta. Si se procesara
   * antes de guardar, un reintento crearia el pedido dos veces aunque despues
   * el insert fallara.
   */
  async procesarMensaje(mensaje: MensajeEntrante): Promise<ResultadoMensaje> {
    const base = { wamid: mensaje.wamid, telefono: mensaje.telefono };

    if (!mensaje.telefono) {
      return { ...base, procesado: false, motivo: 'Mensaje sin telefono' };
    }

    // 1. Deduplicacion. Si ya existe este wamid, Meta esta reintentando.
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
        console.log(`[whatsapp] ${mensaje.wamid} ya estaba registrado, se ignora`);
        return { ...base, procesado: false, motivo: 'Mensaje duplicado' };
      }
      console.error('[whatsapp] no se pudo guardar el mensaje:', error.message);
      return { ...base, procesado: false, motivo: 'Error al guardar' };
    }

    // 2. Palomitas azules: el cliente ve que su mensaje si llego.
    if (!mensaje.wamid.startsWith('test.')) {
      await marcarComoLeido(mensaje.wamid);
    }

    // 3. Tipos que todavia no sabemos atender.
    if (mensaje.tipo !== 'text' || !mensaje.texto) {
      const respuesta =
        'Por ahora solo puedo leer mensajes de texto. Escribeme que necesitas y de cuantos kilos.';
      await this.responder(mensaje.telefono, respuesta, guardado.id);
      return { ...base, procesado: true, motivo: 'Tipo no soportado', respuesta };
    }

    // 4. Aqui entra la extraccion con IA y las reglas de negocio.
    //    Pendiente: paso 8 del plan.
    const respuesta = `Recibi tu mensaje: "${mensaje.texto}". Ya casi puedo tomarte el pedido.`;
    await this.responder(mensaje.telefono, respuesta, guardado.id);

    return { ...base, procesado: true, respuesta };
  },

  /**
   * Responde al cliente y deja la respuesta en la bitacora.
   *
   * Un fallo al enviar no revienta el flujo: el mensaje del cliente ya quedo
   * guardado y el pedido, si se creo, sigue en pie.
   */
  async responder(telefono: string, texto: string, mensajeOrigenId?: string): Promise<void> {
    const envio = await enviarMensaje(telefono, texto);

    await supabase.from('mensajes_whatsapp').insert({
      telefono,
      mensaje: texto,
      tipo: 'bot',
      wa_message_id: envio.wamid ?? null,
      procesado: envio.enviado,
      error: envio.error ?? null
    });

    if (mensajeOrigenId) {
      await supabase
        .from('mensajes_whatsapp')
        .update({ procesado: true })
        .eq('id', mensajeOrigenId);
    }
  }
};
