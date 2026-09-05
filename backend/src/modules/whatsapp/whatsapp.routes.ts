import { Router } from 'express';
import {
  listarHandoffs,
  probarMensaje,
  reanudarHandoff,
  recibirWebhook,
  verificarWebhook
} from './whatsapp.controller';

const router = Router();

// Meta pega aqui una vez para verificar la URL, y despues por cada mensaje.
// Ninguno de los dos pasa por validateRequest: un 400 haria que Meta
// reintentara el mismo mensaje en bucle.
router.get('/webhook', verificarWebhook);
router.post('/webhook', recibirWebhook);

// Chats que el bot dejo de atender porque necesitan a una persona.
router.get('/handoffs', listarHandoffs);
router.post('/handoffs/:telefono/reanudar', reanudarHandoff);

// Simulador para probar el flujo sin Meta de por medio.
router.post('/test', probarMensaje);

export default router;
