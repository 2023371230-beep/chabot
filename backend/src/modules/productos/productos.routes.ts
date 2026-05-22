import { Router } from 'express';
import { validateRequest } from '../../shared/validation/validateRequest';
import {
  activarProducto,
  createProducto,
  desactivarProducto,
  getProducto,
  listProductos,
  updateProducto
} from './productos.controller';
import {
  createProductoSchema,
  productoIdParamsSchema,
  updateProductoSchema
} from './productos.schemas';

const router = Router();

router.get('/', listProductos);
router.get('/:id', validateRequest({ params: productoIdParamsSchema }), getProducto);
router.post('/', validateRequest({ body: createProductoSchema }), createProducto);
router.patch(
  '/:id',
  validateRequest({ params: productoIdParamsSchema, body: updateProductoSchema }),
  updateProducto
);
router.patch(
  '/:id/activar',
  validateRequest({ params: productoIdParamsSchema }),
  activarProducto
);
router.patch(
  '/:id/desactivar',
  validateRequest({ params: productoIdParamsSchema }),
  desactivarProducto
);

export default router;
