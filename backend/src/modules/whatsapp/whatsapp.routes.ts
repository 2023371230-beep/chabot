import { Router } from 'express';
import {
  probarMensaje,
  recibirWebhook,
  verificarWebhook
} from './whatsapp.controller';

const router = Router();

// Meta pega aqui una vez para verificar la URL, y despues por cada mensaje.
// Ninguno de los dos pasa por validateRequest: un 400 haria que Meta
// reintentara el mismo mensaje en bucle.
router.get('/webhook', verificarWebhook);
router.post('/webhook', recibirWebhook);

// Simulador para probar el flujo sin Meta de por medio.
router.post('/test', probarMensaje);

export default router;
