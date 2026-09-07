export type Producto = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio_kg: number | string;
  /** Lo que cuesta el kilo. 0 = sin capturar: los reportes no calculan margen. */
  costo_kg: number | string;
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
  /**
   * Costo del kilo EN EL MOMENTO de la venta, congelado igual que el precio.
   *
   * 0 significa que no se habia capturado el costo de ese producto. No es lo
   * mismo que un costo de cero, y los reportes lo distinguen: con cobertura
   * parcial no dan margen, porque seria una mezcla de ganancia real e ingreso
   * puro.
   */
  costo_kg?: number | string;
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

/**
 * Un chat donde el asistente se detuvo a proposito y espera a una persona.
 *
 * `motivo` viene del backend como texto libre para que agregar un motivo nuevo
 * alla no obligue a tocar el frontend; la interfaz lo traduce con un mapa y
 * cae en un texto generico si no lo conoce.
 */
export type ChatPausado = {
  id: string;
  telefono: string;
  motivo: string;
  detalle: string | null;
  nombreCliente: string | null;
  pausadoEn: string;
  ultimoMensaje: string | null;
};

/**
 * Un mensaje del hilo de WhatsApp, listo para pintarse.
 *
 * `tipo` decide el lado: `cliente` a la izquierda, `bot` a la derecha y
 * `sistema` al centro — esos ultimos son los eventos que explican por que la
 * conversacion se corta de golpe, como cuando el bot se detiene por una queja.
 */
export type MensajeChat = {
  id: string;
  tipo: 'cliente' | 'bot' | 'asesor' | 'sistema';
  texto: string;
  en: string;
  error: string | null;
};

/** Una conversacion en la bandeja, sin el hilo completo. */
export type ConversacionResumen = {
  telefono: string;
  nombreCliente: string | null;
  clienteId: string | null;
  ultimoMensaje: string;
  ultimoEn: string;
  totalMensajes: number;
  pausada: boolean;
  ultimoDelCliente: string | null;
};
