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
const labels: Record<PedidoEstado, string> = {
  pendiente: 'pendiente',
  confirmado: 'confirmado',
  completado: 'entregado',
  cancelado: 'cancelado'
};

export function StatusBadge({ estado }: { estado: PedidoEstado }) {
  return <Badge variant={variants[estado]}>{labels[estado]}</Badge>;
}
