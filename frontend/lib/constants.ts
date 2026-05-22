import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Users
} from 'lucide-react';

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/productos', label: 'Productos', icon: Boxes },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/inventario', label: 'Inventario', icon: BarChart3 },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/configuracion', label: 'Configuracion', icon: Settings }
];

export const orderStatuses = [
  'pendiente',
  'confirmado',
  'completado',
  'cancelado'
] as const;
export const orderOrigins = ['dashboard', 'manual', 'whatsapp'] as const;
export const inventoryTypes = ['entrada', 'venta', 'ajuste', 'merma'] as const;
