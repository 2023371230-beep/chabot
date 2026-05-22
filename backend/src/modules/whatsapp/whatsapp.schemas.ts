import { z } from 'zod';

export const whatsappWebhookSchema = z.object({
  telefono: z.string().trim().min(5).max(30).optional(),
  mensaje: z.string().trim().min(1).optional()
});
