import {
  IconClientes,
  IconConfiguracion,
  IconDashboard,
  IconInventario,
  IconPedidos,
  IconProductos,
  IconReportes,
  IconWhatsapp
} from '@/components/icons';

/**
 * WhatsApp ya esta en el menu: el bot toma pedidos de verdad, y su pestaña es
 * donde se ven los chats que se detuvieron esperando a una persona. Lleva
 * badge porque un chat pausado que nadie ve es un cliente abandonado.
 */
export const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: IconDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: IconPedidos },
  { href: '/productos', label: 'Productos', icon: IconProductos },
  { href: '/clientes', label: 'Clientes', icon: IconClientes },
  { href: '/inventario', label: 'Inventario', icon: IconInventario },
  { href: '/reportes', label: 'Reportes', icon: IconReportes },
  { href: '/whatsapp', label: 'WhatsApp', icon: IconWhatsapp },
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
