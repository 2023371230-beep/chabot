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
      };
    }>;
  }>;
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

/** true si el payload solo trae acuses de entrega, no mensajes de nadie. */
export const esSoloEstados = (payload: MetaWebhookPayload): boolean => {
  let hayEstados = false;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.value?.messages?.length) return false;
      if (change.value?.statuses?.length) hayEstados = true;
    }
  }
  return hayEstados;
};
