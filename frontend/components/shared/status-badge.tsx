import { Badge } from '@/components/ui/badge';
import type { PedidoEstado } from '@/types/models';

const variants: Record<PedidoEstado, 'warning' | 'info' | 'success' | 'danger'> = {
  pendiente: 'warning',
  confirmado: 'info',
  completado: 'success',
  cancelado: 'danger'
};

export function StatusBadge({ estado }: { estado: PedidoEstado }) {
  return <Badge variant={variants[estado]}>{estado}</Badge>;
}
