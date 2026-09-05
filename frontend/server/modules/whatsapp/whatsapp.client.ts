import { env, isWhatsappSendConfigured } from '../../config/env';

/**
 * Cliente de la WhatsApp Cloud API de Meta.
 *
 * Solo habla con Meta. No sabe nada de pedidos ni de negocio: eso vive en el
 * servicio. Asi se puede probar el envio sin arrastrar media aplicacion.
 */

const graphUrl = (path: string) =>
  `https://graph.facebook.com/${env.whatsapp.apiVersion}/${path}`;

type MetaError = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
};

/**
 * Numero en el formato que espera Meta: solo digitos.
 * Meta rechaza el `+`, los espacios y los guiones.
 */
export const normalizarTelefono = (telefono: string): string =>
  telefono.replace(/\D/g, '');

/**
 * Manda un mensaje de texto libre.
 *
 * OJO con la ventana de 24 horas: Meta solo permite texto libre si el cliente
 * escribio en las ultimas 24 h. Fuera de esa ventana hay que usar una
 * plantilla aprobada, o la API responde error 131047.
 */
export const enviarMensaje = async (
  telefono: string,
  mensaje: string
): Promise<{ enviado: boolean; wamid?: string; error?: string }> => {
  if (!isWhatsappSendConfigured()) {
    return {
      enviado: false,
      error: 'Falta WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en el .env'
    };
  }

  try {
    const response = await fetch(graphUrl(`${env.whatsapp.phoneNumberId}/messages`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: normalizarTelefono(telefono),
        type: 'text',
        // preview_url false: si el cliente pide "pollo.com" no queremos que
        // WhatsApp pinte una tarjeta de link en la respuesta.
        text: { preview_url: false, body: mensaje }
      })
    });

    const payload = (await response.json()) as MetaError & {
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      const detalle = payload.error?.message ?? `HTTP ${response.status}`;
      // No se lanza: que falle el envio no debe tumbar el procesamiento del
      // pedido, que ya quedo guardado. Se reporta y se sigue.
      console.error('[whatsapp] no se pudo enviar:', detalle);
      return { enviado: false, error: detalle };
    }

    return { enviado: true, wamid: payload.messages?.[0]?.id };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : 'Error de red';
    console.error('[whatsapp] error de red al enviar:', detalle);
    return { enviado: false, error: detalle };
  }
};

/**
 * Marca el mensaje como leido (las palomitas azules).
 *
 * Es cosmetico pero importa: sin esto el cliente ve su mensaje sin entregar
 * mientras el bot procesa, y vuelve a escribir pensando que no llego.
 */
export const marcarComoLeido = async (wamid: string): Promise<void> => {
  if (!isWhatsappSendConfigured()) return;

  try {
    await fetch(graphUrl(`${env.whatsapp.phoneNumberId}/messages`), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: wamid
      })
    });
  } catch {
    // Silencioso a proposito: que no se marque como leido nunca justifica
    // interrumpir la atencion del pedido.
  }
};
