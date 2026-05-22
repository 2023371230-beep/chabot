import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import { whatsappWebhook } from './whatsapp.controller';
import { whatsappWebhookSchema } from './whatsapp.schemas';

const router = Router();

router.post(
  '/webhook',
  validateRequest({ body: whatsappWebhookSchema }),
  whatsappWebhook
);

export default router;
