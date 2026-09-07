'use client';

import { Badge } from '@/client/components/ui/badge';
import { DataTable, type Column } from '@/client/components/shared/data-table';
import { formatCurrency, formatKg } from '@/client/lib/formatters';
import type { Producto } from '@/client/types/models';
import { ProductActions } from './product-actions';

/**
 * Tabla del catalogo.
 *
 * Se quitaron dos columnas que no aportaban: `Estado` decia "activo" en las
 * nueve filas, y el badge "ok" junto al stock repetia lo mismo con otras
 * palabras. Lo unico que importa mirar de un vistazo es cuando el stock cae
 * por debajo del minimo, y eso es lo unico que ahora se marca.
 */
export function ProductsTable({
  products,
  loading,
  onEdit,
  onToggle
}: {
  products: Producto[];
  loading?: boolean;
  onEdit: (product: Producto) => void;
  onToggle: (product: Producto) => void;
}) {
  const columns: Column<Producto>[] = [
    {
      header: 'Producto',
      primary: true,
      cell: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className={row.activo ? 'font-medium' : 'font-medium text-muted-foreground'}>
              {row.nombre}
            </span>
            {!row.activo ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                fuera del catalogo
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{row.categoria ?? 'pollo'}</div>
        </div>
      )
    },
    { header: 'Precio', cell: (row) => formatCurrency(row.precio_kg) },
    {
      header: 'Stock',
      cell: (row) => {
        const bajo = Number(row.stock_actual) <= Number(row.stock_minimo);
        return (
          <div className="flex items-center gap-2">
            <span className={bajo ? 'font-medium text-warning' : undefined}>
              {formatKg(row.stock_actual)}
            </span>
            {/* Solo se marca la excepcion. Un badge "ok" en cada fila que esta
                bien no informa: entrena al ojo a ignorar la columna entera, que
                es justo lo contrario de lo que se busca. */}
            {bajo ? <Badge variant="warning">bajo minimo</Badge> : null}
            <span className="text-xs text-muted-foreground">
              min {formatKg(row.stock_minimo)}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      className: 'text-right',
      full: true,
      cell: (row) => (
        <ProductActions product={row} onEdit={onEdit} onToggle={onToggle} />
      )
    }
  ];

  return (
    <DataTable
      data={products}
      columns={columns}
      loading={loading}
      emptyTitle="Sin productos"
      emptyDescription="Crea el primer producto para comenzar a registrar pedidos."
    />
  );
}
