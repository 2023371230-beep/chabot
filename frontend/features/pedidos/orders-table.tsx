'use client';

import { Eye } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate, formatKg } from '@/lib/formatters';
import type { Pedido } from '@/types/models';
import { OrderStatusActions } from './order-status-actions';

export function OrdersTable({
  orders,
  loading,
  onUpdated
}: {
  orders: Pedido[];
  loading?: boolean;
  onUpdated?: () => Promise<void> | void;
}) {
  const columns: Column<Pedido>[] = [
    {
      header: 'Cliente',
      cell: (row) => (
        <div>
          <div className="font-medium">
            {row.clientes?.nombre ?? row.cliente?.nombre ?? 'Cliente'}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.clientes?.telefono ?? row.cliente?.telefono}
          </div>
        </div>
      )
    },
    { header: 'Entrega', cell: (row) => formatDate(row.fecha_entrega) },
    { header: 'Estado', cell: (row) => <StatusBadge estado={row.estado} /> },
    { header: 'Kg', cell: (row) => formatKg(row.total_kg) },
    { header: 'Total', cell: (row) => formatCurrency(row.total_precio) },
    {
      header: 'Acciones',
      className: 'text-right',
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/pedidos/${row.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <OrderStatusActions order={row} onUpdated={onUpdated} />
        </div>
      )
    }
  ];

  return (
    <DataTable
      data={orders}
      columns={columns}
      loading={loading}
      emptyTitle="Sin pedidos"
      emptyDescription="Crea el primer pedido desde el dashboard o desde WhatsApp."
    />
  );
}
