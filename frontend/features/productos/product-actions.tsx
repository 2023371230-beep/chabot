'use client';

import { Check, Pencil, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Producto } from '@/types/models';

export function ProductActions({
  product,
  onEdit,
  onToggle
}: {
  product: Producto;
  onEdit: (product: Producto) => void;
  onToggle: (product: Producto) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="icon" title="Editar" onClick={() => onEdit(product)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => onToggle(product)}>
        {product.activo ? <Power className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {product.activo ? 'Desactivar' : 'Activar'}
      </Button>
    </div>
  );
}
