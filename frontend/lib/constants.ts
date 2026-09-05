import {
  IconClientes,
  IconConfiguracion,
  IconDashboard,
  IconInventario,
  IconPedidos,
  IconProductos,
  IconReportes
} from '@/components/icons';

/**
 * WhatsApp queda fuera del menu a proposito: la pantalla existe pero todavia
 * no mide nada real (el bot no esta conectado). Mostrar estado inventado es
 * peor que no mostrar nada. Se vuelve a agregar cuando el webhook funcione.
 */
export const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: IconDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: IconPedidos },
  { href: '/productos', label: 'Productos', icon: IconProductos },
  { href: '/clientes', label: 'Clientes', icon: IconClientes },
  { href: '/inventario', label: 'Inventario', icon: IconInventario },
  { href: '/reportes', label: 'Reportes', icon: IconReportes },
  { href: '/configuracion', label: 'Reglas', icon: IconConfiguracion }
];

export const orderStatuses = [
  'pendiente',
  'confirmado',
  'completado',
  'cancelado'
] as const;
export const orderOrigins = ['dashboard', 'manual', 'whatsapp'] as const;
export const inventoryTypes = ['entrada', 'venta', 'ajuste', 'merma'] as const;
