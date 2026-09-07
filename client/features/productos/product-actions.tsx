'use client';

import { IconCheck, IconEditar, IconEncendido } from '@/client/components/icons';
import { ConfirmDialog } from '@/client/components/shared/confirm-dialog';
import { Button } from '@/client/components/ui/button';
import type { Producto } from '@/client/types/models';

/**
 * Desactivar no borra: saca al producto del catalogo para pedidos nuevos pero
 * conserva su historial. Como esa distincion no es obvia, va escrita en el
 * dialogo en vez de dejarla a la interpretacion del usuario.
 *
 * El peso visual esta invertido a proposito respecto a como estaba: editar
 * lleva texto y quitar se queda en icono. Antes era al reves, y al recorrer la
 * fila lo que se leia era "Quitar del catalogo" — el sistema anunciaba la
 * salida en cada renglon, mientras la accion que se usa a diario no tenia
 * nombre.
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
        variant="outline"
        size="sm"
        title={`Editar ${product.nombre}`}
        onClick={() => onEdit(product)}
      >
        <IconEditar />
        Editar
      </Button>

      {product.activo ? (
        <ConfirmDialog
          title={`Quitar ${product.nombre} del catalogo`}
          description="Deja de aparecer al crear pedidos nuevos, pero su historial y sus pedidos anteriores se conservan. Lo puedes volver a activar cuando quieras."
          confirmLabel="Si, quitarlo del catalogo"
          cancelLabel="No, dejarlo activo"
          onConfirm={() => onToggle(product)}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              title={`Quitar ${product.nombre} del catalogo`}
              aria-label={`Quitar ${product.nombre} del catalogo`}
            >
              <IconEncendido />
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
