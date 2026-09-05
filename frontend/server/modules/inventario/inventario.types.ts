export type InventarioTipo = 'entrada' | 'venta' | 'ajuste' | 'merma';

export type CreateInventarioMovimientoInput = {
  producto_id: string;
  tipo: InventarioTipo;
  cantidad_kg: number;
  motivo?: string;
  usuario_id?: string;
  pedido_id?: string;
};

export type InventarioMovimiento = CreateInventarioMovimientoInput & {
  id: string;
  created_at: string;
};
