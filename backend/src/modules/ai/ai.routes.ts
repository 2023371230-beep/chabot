import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import { extractOrder } from './ai.controller';
import { extractOrderSchema } from './ai.schemas';

const router = Router();

router.post(
  '/extract-order',
  validateRequest({ body: extractOrderSchema }),
  extractOrder
);

export default router;
