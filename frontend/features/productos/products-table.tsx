'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatKg } from '@/lib/formatters';
import type { Producto } from '@/types/models';
import { ProductActions } from './product-actions';

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
      cell: (row) => (
        <div>
          <div className="font-medium">{row.nombre}</div>
          <div className="text-xs text-muted-foreground">{row.categoria ?? 'pollo'}</div>
        </div>
      )
    },
    { header: 'Precio', cell: (row) => formatCurrency(row.precio_kg) },
    {
      header: 'Stock',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {formatKg(row.stock_actual)}
          {Number(row.stock_actual) <= Number(row.stock_minimo) ? (
            <Badge variant="warning">bajo</Badge>
          ) : (
            <Badge variant="success">ok</Badge>
          )}
        </div>
      )
    },
    { header: 'Minimo', cell: (row) => formatKg(row.stock_minimo) },
    {
      header: 'Estado',
      cell: (row) => (
        <Badge variant={row.activo ? 'success' : 'danger'}>
          {row.activo ? 'activo' : 'inactivo'}
        </Badge>
      )
    },
    {
      header: 'Acciones',
      className: 'text-right',
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
