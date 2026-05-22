import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { whatsappService } from './whatsapp.service';

export const whatsappWebhook = asyncHandler(async (req: Request, res: Response) => {
  // Futuro: adaptar aqui el payload de Baileys o Meta WhatsApp Cloud API.
  // El servicio solo persiste el mensaje entrante y responde rapido.
  const result = await whatsappService.processWebhook(req.body);
  sendSuccess(res, 'Mensaje recibido', result);
});
