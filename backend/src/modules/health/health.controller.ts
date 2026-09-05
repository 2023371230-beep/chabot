import type { Request, Response } from 'express';
import { estadoPresupuesto } from '../whatsapp/whatsapp.presupuesto';

/**
 * Se expone la cuota de IA que queda porque es el unico recurso del sistema
 * que se puede agotar solo, sin que nadie lo note, hasta que el bot deja de
 * tomar pedidos. Ver el numero bajando es lo que da tiempo a reaccionar.
 */
export const getHealth = (_req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Backend running',
    timestamp: new Date().toISOString(),
    ia: estadoPresupuesto()
  });
};
