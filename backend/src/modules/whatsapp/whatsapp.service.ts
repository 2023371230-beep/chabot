import { supabase } from '../../database/supabase.client';
import { AppError } from '../../shared/errors/AppError';

type WhatsappWebhookInput = {
  telefono?: string;
  mensaje?: string;
  [key: string]: unknown;
};

export const whatsappService = {
  async processWebhook(input: WhatsappWebhookInput) {
    if (!input.telefono || !input.mensaje) {
      return {
        stored: false,
        reason: 'Payload recibido sin telefono o mensaje',
        payload: input
      };
    }

    const { data, error } = await supabase
      .from('mensajes_whatsapp')
      .insert({
        telefono: input.telefono,
        mensaje: input.mensaje,
        tipo: 'cliente',
        procesado: false
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError('No se pudo guardar el mensaje de WhatsApp', 400, [error]);
    }

    return {
      stored: true,
      mensaje: data
    };
  }
};
