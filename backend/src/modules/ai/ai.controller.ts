import type { Request, Response } from 'express';
import { asyncHandler } from '../../shared/errors/asyncHandler';
import { sendSuccess } from '../../shared/response/apiResponse';
import { aiService } from './ai.service';

export const extractOrder = asyncHandler(async (req: Request, res: Response) => {
  const result = await aiService.extractOrderFromMessage(req.body.message);

  if (!result.configured) {
    sendSuccess(res, 'Groq no configurado', result);
    return;
  }

  sendSuccess(res, 'Pedido extraido', result);
});
