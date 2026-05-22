'use client';

import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/shared/data-table';
import { formatDateTime, formatKg } from '@/lib/formatters';
import type { InventarioMovimiento } from '@/types/models';

export function InventoryMovementsTable({
  rows,
  loading
}: {
  rows: InventarioMovimiento[];
  loading?: boolean;
}) {
  const columns: Column<InventarioMovimiento>[] = [
    { header: 'Fecha', cell: (row) => formatDateTime(row.created_at) },
    { header: 'Producto', cell: (row) => row.productos?.nombre ?? row.producto_id },
    {
      header: 'Tipo',
      cell: (row) => (
        <Badge
          variant={
            row.tipo === 'entrada' || row.tipo === 'ajuste'
              ? 'success'
              : row.tipo === 'merma'
                ? 'warning'
                : 'info'
          }
        >
          {row.tipo}
        </Badge>
      )
    },
    { header: 'Cantidad', cell: (row) => formatKg(row.cantidad_kg) },
    { header: 'Motivo', cell: (row) => row.motivo ?? 'Sin motivo' }
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      emptyTitle="Sin movimientos"
    />
  );
}
