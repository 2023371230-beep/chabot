import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import { getConfiguracion, updateConfiguracion } from './configuracion.controller';
import {
  configuracionIdParamsSchema,
  updateConfiguracionSchema
} from './configuracion.schemas';

const router = Router();

router.get('/', getConfiguracion);
router.patch(
  '/:id',
  validateRequest({
    params: configuracionIdParamsSchema,
    body: updateConfiguracionSchema
  }),
  updateConfiguracion
);

export default router;
