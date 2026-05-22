export type PedidoEstado = 'pendiente' | 'confirmado' | 'completado' | 'cancelado';
export type PedidoOrigen = 'whatsapp' | 'dashboard' | 'manual';

export type PedidoProductoInput = {
  producto_id: string;
  kg: number;
};

export type PedidoClienteInput = {
  id?: string;
  nombre?: string;
  telefono: string;
  direccion?: string;
  notas?: string;
};

export type CreatePedidoInput = {
  cliente: PedidoClienteInput;
  fecha_entrega?: string;
  origen?: PedidoOrigen;
  notas?: string;
  productos: PedidoProductoInput[];
};

export type UpdatePedidoInput = {
  fecha_entrega?: string;
  estado?: PedidoEstado;
  notas?: string;
  productos?: PedidoProductoInput[];
};

export type UpdatePedidoEstadoInput = {
  estado: PedidoEstado;
};

export type PedidoDetalle = {
  id: string;
  pedido_id: string;
  producto_id: string;
  kg: number | string;
  precio_kg: number | string;
  subtotal: number | string;
  created_at: string;
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
  pedido_detalles?: PedidoDetalle[];
};
