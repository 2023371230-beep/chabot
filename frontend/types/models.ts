export type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio_kg: number | string;
  stock_actual: number | string;
  stock_minimo: number | string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Cliente = {
  id: string;
  nombre: string | null;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type PedidoEstado = 'pendiente' | 'confirmado' | 'completado' | 'cancelado';
export type PedidoOrigen = 'whatsapp' | 'dashboard' | 'manual';

export type PedidoDetalle = {
  id: string;
  pedido_id: string;
  producto_id: string;
  kg: number | string;
  precio_kg: number | string;
  subtotal: number | string;
  created_at: string;
  productos?: Producto;
  producto?: Producto;
};

export type Pedido = {
  id: string;
  cliente_id: string;
  fecha_entrega: string | null;
  estado: PedidoEstado;
  origen: PedidoOrigen;
  notas: string | null;
  total_kg: number | string;
  total_precio: number | string;
  created_at: string;
  updated_at: string;
  clientes?: Cliente;
  cliente?: Cliente;
  pedido_detalles?: PedidoDetalle[];
  detalles?: PedidoDetalle[];
};

export type InventarioResumen = {
  producto_id: string;
  nombre: string;
  categoria: string | null;
  precio_kg: number | string;
  stock_actual: number | string;
  stock_minimo: number | string;
  total_entradas: number;
  total_ventas: number;
  total_mermas: number;
  total_ajustes: number;
};

export type InventarioMovimiento = {
  id: string;
  producto_id: string;
  tipo: 'entrada' | 'venta' | 'ajuste' | 'merma';
  cantidad_kg: number | string;
  motivo: string | null;
  usuario_id?: string | null;
  pedido_id?: string | null;
  created_at: string;
  productos?: Pick<Producto, 'nombre' | 'categoria'>;
};

export type ConfiguracionEmpresa = {
  id: string;
  kg_limite_rapido: number | string;
  dias_preparacion_mayoreo: number;
  horario_apertura: string;
  horario_cierre: string;
  mensaje_fuera_horario: string | null;
  created_at: string;
  updated_at: string;
};
