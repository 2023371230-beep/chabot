import { Router } from 'express';
import aiRoutes from '../modules/ai/ai.routes';
import clientesRoutes from '../modules/clientes/clientes.routes';
import configuracionRoutes from '../modules/configuracion/configuracion.routes';
import healthRoutes from '../modules/health/health.routes';
import inventarioRoutes from '../modules/inventario/inventario.routes';
import pedidosRoutes from '../modules/pedidos/pedidos.routes';
import productosRoutes from '../modules/productos/productos.routes';
import whatsappRoutes from '../modules/whatsapp/whatsapp.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/productos', productosRoutes);
router.use('/clientes', clientesRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/configuracion', configuracionRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/ai', aiRoutes);

export default router;
