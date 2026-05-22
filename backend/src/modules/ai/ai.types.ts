export type ExtractedOrderIntent =
  | 'pedido'
  | 'consulta'
  | 'queja'
  | 'saludo'
  | 'desconocido';

export type ExtractedOrder = {
  intent: ExtractedOrderIntent;
  productos: Array<{
    nombre_producto: string;
    kg: number | null;
  }>;
  fecha_entrega: string | null;
  notas: string | null;
};
