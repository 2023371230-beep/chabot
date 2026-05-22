import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import {
  createCliente,
  getCliente,
  listClientes,
  updateCliente
} from './clientes.controller';
import {
  clienteIdParamsSchema,
  createClienteSchema,
  updateClienteSchema
} from './clientes.schemas';

const router = Router();

router.get('/', listClientes);
router.get('/:id', validateRequest({ params: clienteIdParamsSchema }), getCliente);
router.post('/', validateRequest({ body: createClienteSchema }), createCliente);
router.patch(
  '/:id',
  validateRequest({ params: clienteIdParamsSchema, body: updateClienteSchema }),
  updateCliente
);

export default router;
