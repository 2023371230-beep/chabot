import { Badge } from '@/client/components/ui/badge';
import type { PedidoEstado } from '@/client/types/models';

const variants: Record<PedidoEstado, 'warning' | 'info' | 'success' | 'danger'> = {
  pendiente: 'warning',
  confirmado: 'info',
  completado: 'success',
  cancelado: 'danger'
};

/**
 * El estado nunca se comunica solo con color: el sello lleva la palabra
 * impresa dentro. `sin descontar` / `stock descontado` explican la unica
 * consecuencia que le importa al dueño.
 */
/**
 * Se exporta para que el filtro de Pedidos use ESTE mapa y no el enum crudo.
 *
 * Antes el desplegable decia "completado" mientras la insignia de la misma
 * fila decia "entregado": dos palabras para el mismo hecho, a treinta pixeles
 * una de otra. Con una sola fuente no pueden volver a divergir.
 */
export const ETIQUETA_ESTADO: Record<PedidoEstado, string> = {
  pendiente: 'pendiente',
  confirmado: 'confirmado',
  completado: 'entregado',
  cancelado: 'cancelado'
};

export function StatusBadge({ estado }: { estado: PedidoEstado }) {
  return <Badge variant={variants[estado]}>{ETIQUETA_ESTADO[estado]}</Badge>;
}
