/**
 * Payload del webhook de Meta.
 *
 * La forma real viene muy anidada:
 *   entry[] > changes[] > value > messages[]
 *
 * Ademas el mismo webhook entrega DOS cosas distintas por el mismo canal:
 *   - `messages`  -> alguien te escribio
 *   - `statuses`  -> cambio el estado de un mensaje QUE TU MANDASTE
 *                    (sent/delivered/read/failed)
 *
 * Confundirlas es el error clasico: los `statuses` llegan todo el tiempo y si
 * se tratan como mensajes entrantes el bot se responde a si mismo en bucle.
 */

export type MetaTextMessage = {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
};

export type MetaContact = {
  wa_id: string;
  profile?: { name?: string };
};

export type MetaStatus = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  recipient_id?: string;
};

/**
 * Un mensaje que salio del numero del negocio desde OTRA superficie.
 *
 * Meta lo manda cuando alguien contesta desde la app de WhatsApp Business o
 * desde el Business Suite, no desde esta API. Es la señal de que el dueño
 * agarro su celular: en cuanto llega, el bot debe callarse en ese chat para no
 * competir con quien ya esta atendiendo.
 */
export type MetaEcho = {
  id?: string;
  /** A quien se le mando. */
  to?: string;
  recipient_id?: string;
  timestamp?: string;
  type?: string;
  text?: { body: string };
};

export type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: MetaContact[];
        messages?: MetaTextMessage[];
        statuses?: MetaStatus[];
        message_echoes?: MetaEcho[];
      };
    }>;
  }>;
};

/** Un eco ya aplanado: a quien y que se le dijo. */
export type EcoSaliente = {
  telefono: string;
  texto: string;
  wamid: string | null;
  en: Date;
};

/**
 * Aplana los ecos del payload.
 *
 * Van aparte de `extraerMensajes` a proposito: un eco NO es un mensaje
 * entrante. Tratarlos igual haria que el bot intentara "atender" lo que acaba
 * de decir una persona, que es exactamente lo contrario de lo que debe pasar.
 */
export const extraerEcos = (payload: MetaWebhookPayload): EcoSaliente[] => {
  const salida: EcoSaliente[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const e of change.value?.message_echoes ?? []) {
        const telefono = e.to ?? e.recipient_id;
        if (!telefono) continue;

        salida.push({
          telefono,
          texto: e.text?.body?.trim() ?? `[${e.type ?? 'mensaje'}]`,
          wamid: e.id ?? null,
          // El timestamp de Meta viene en SEGUNDOS.
          en: new Date(Number(e.timestamp ?? 0) * 1000 || Date.now())
        });
      }
    }
  }

  return salida;
};

/** Un mensaje entrante ya aplanado y listo para trabajar. */
export type MensajeEntrante = {
  /** wamid.xxx — la llave de deduplicacion. */
  wamid: string;
  telefono: string;
  nombrePerfil?: string;
  texto: string;
  tipo: string;
  recibidoEn: Date;
};

/**
 * Aplana el payload de Meta a mensajes de texto utilizables.
 *
 * Descarta los `statuses` y los tipos que no sabemos atender (imagen, audio,
 * ubicacion, sticker): el llamador decide que responder ante esos.
 */
export const extraerMensajes = (payload: MetaWebhookPayload): MensajeEntrante[] => {
  const salida: MensajeEntrante[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;

      // El nombre del perfil viene aparte, en `contacts`, emparejado por wa_id.
      const nombrePorWaId = new Map<string, string | undefined>();
      for (const c of value.contacts ?? []) {
        nombrePorWaId.set(c.wa_id, c.profile?.name);
      }

      for (const m of value.messages) {
        salida.push({
          wamid: m.id,
          telefono: m.from,
          nombrePerfil: nombrePorWaId.get(m.from),
          // El timestamp de Meta viene en SEGUNDOS, no milisegundos.
          recibidoEn: new Date(Number(m.timestamp) * 1000),
          tipo: m.type,
          texto: m.text?.body?.trim() ?? ''
        });
      }
    }
  }

  return salida;
};

/**
 * true si el payload solo trae acuses de entrega.
 *
 * Los ecos cuentan como contenido: no son mensajes entrantes, pero si hay que
 * actuar sobre ellos.
 */
export const esSoloEstados = (payload: MetaWebhookPayload): boolean => {
  let hayEstados = false;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.value?.messages?.length) return false;
      if (change.value?.message_echoes?.length) return false;
      if (change.value?.statuses?.length) hayEstados = true;
    }
  }
  return hayEstados;
};

/**
 * Lo que devuelve atender un mensaje: que contestarle y, si nacio uno, el
 * pedido.
 *
 * `pedidoId` viaja hasta el webhook porque es lo que permite enlazar la
 * conversacion con el pedido que produjo. Vive aqui y no en un modulo
 * concreto para que ninguno de los que atienden tenga que importar a otro
 * solo para nombrar su tipo de vuelta.
 */
export type Atencion = { respuesta: string; pedidoId?: string };

/** Un pedido con lo justo para hablar de el con el cliente. */
export type PedidoDelCliente = {
  id: string;
  estado: string;
  fecha_entrega: string | null;
  total_kg: number | string;
  total_precio: number | string;
  created_at: string;
  pedido_detalles?: Array<{
    producto_id: string;
    kg: number | string;
    productos?: { nombre?: string } | null;
  }>;
};
