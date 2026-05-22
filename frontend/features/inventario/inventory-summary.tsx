'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatCurrency, formatKg } from '@/lib/formatters';
import type { InventarioResumen } from '@/types/models';

export function InventorySummary({
  rows,
  loading
}: {
  rows: InventarioResumen[];
  loading?: boolean;
}) {
  const columns: Column<InventarioResumen>[] = [
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
          <Badge variant={Number(row.stock_actual) <= Number(row.stock_minimo) ? 'warning' : 'success'}>
            {Number(row.stock_actual) <= Number(row.stock_minimo) ? 'bajo' : 'ok'}
          </Badge>
        </div>
      )
    },
    { header: 'Entradas', cell: (row) => formatKg(row.total_entradas) },
    { header: 'Ventas', cell: (row) => formatKg(row.total_ventas) },
    { header: 'Mermas', cell: (row) => formatKg(row.total_mermas) },
    { header: 'Ajustes', cell: (row) => formatKg(row.total_ajustes) }
  ];

  return <DataTable data={rows} columns={columns} loading={loading} emptyTitle="Sin inventario" />;
}
