import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import {
  createMovimiento,
  getResumenInventario,
  listMovimientos
} from './inventario.controller';
import { createInventarioMovimientoSchema } from './inventario.schemas';

const router = Router();

router.get('/movimientos', listMovimientos);
router.post(
  '/movimientos',
  validateRequest({ body: createInventarioMovimientoSchema }),
  createMovimiento
);
router.get('/resumen', getResumenInventario);

export default router;
