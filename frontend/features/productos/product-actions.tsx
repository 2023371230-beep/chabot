'use client';

import { IconCheck, IconEditar, IconEncendido } from '@/components/icons';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import type { Producto } from '@/types/models';

/**
 * Desactivar no borra: saca al producto del catalogo para pedidos nuevos pero
 * conserva su historial. Como esa distincion no es obvia, va escrita en el
 * dialogo en vez de dejarla a la interpretacion del usuario.
 */
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
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        title={`Editar ${product.nombre}`}
        aria-label={`Editar ${product.nombre}`}
        onClick={() => onEdit(product)}
      >
        <IconEditar />
      </Button>

      {product.activo ? (
        <ConfirmDialog
          title={`Quitar ${product.nombre} del catalogo`}
          description="Deja de aparecer al crear pedidos nuevos, pero su historial y sus pedidos anteriores se conservan. Lo puedes volver a activar cuando quieras."
          confirmLabel="Si, quitarlo del catalogo"
          cancelLabel="No, dejarlo activo"
          onConfirm={() => onToggle(product)}
          trigger={
            <Button variant="outline" size="sm">
              <IconEncendido />
              Quitar del catalogo
            </Button>
          }
        />
      ) : (
        <Button variant="success-soft" size="sm" onClick={() => onToggle(product)}>
          <IconCheck />
          Volver a activar
        </Button>
      )}
    </div>
  );
}
