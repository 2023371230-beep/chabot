'use client';

import { Badge } from '@/client/components/ui/badge';
import { DataTable, type Column } from '@/client/components/shared/data-table';
import { formatDateTime, formatKg } from '@/client/lib/formatters';
import type { InventarioMovimiento } from '@/client/types/models';

export function InventoryMovementsTable({
  rows,
  loading
}: {
  rows: InventarioMovimiento[];
  loading?: boolean;
}) {
  const columns: Column<InventarioMovimiento>[] = [
    {
      header: 'Fecha',
      ordenar: (row) => row.created_at,
      cell: (row) => formatDateTime(row.created_at)
    },
    {
      header: 'Producto',
      ordenar: (row) => row.productos?.nombre ?? '',
      cell: (row) => row.productos?.nombre ?? row.producto_id
    },
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
    {
      header: 'Cantidad',
      className: 'text-right font-num',
      ordenar: (row) => Number(row.cantidad_kg),
      cell: (row) => formatKg(row.cantidad_kg)
    },
    {
      header: 'Motivo',
      // El '??' no atrapa la cadena vacia, asi que las entradas manuales sin
      // motivo salian con la celda en blanco. Una raya dice 'no hay dato';
      // el hueco solo parece un fallo de carga.
      cell: (row) => row.motivo?.trim() || <span className="text-muted-foreground">—</span>
    }
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
