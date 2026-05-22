import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import {
  createPedido,
  getPedido,
  listPedidos,
  updatePedido,
  updatePedidoEstado
} from './pedidos.controller';
import {
  createPedidoSchema,
  pedidoIdParamsSchema,
  updatePedidoEstadoSchema,
  updatePedidoSchema
} from './pedidos.schemas';

const router = Router();

router.get('/', listPedidos);
router.get('/:id', validateRequest({ params: pedidoIdParamsSchema }), getPedido);
router.post('/', validateRequest({ body: createPedidoSchema }), createPedido);
router.patch(
  '/:id',
  validateRequest({ params: pedidoIdParamsSchema, body: updatePedidoSchema }),
  updatePedido
);
router.patch(
  '/:id/estado',
  validateRequest({
    params: pedidoIdParamsSchema,
    body: updatePedidoEstadoSchema
  }),
  updatePedidoEstado
);

export default router;
