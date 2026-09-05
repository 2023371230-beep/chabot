'use client';

import { IconVer } from '@/components/icons';
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
  onUpdated,
  emptyTitle = 'Sin pedidos',
  emptyDescription = 'Crea el primero desde el boton de arriba o espera a que entre por WhatsApp.'
}: {
  orders: Pedido[];
  loading?: boolean;
  onUpdated?: () => Promise<void> | void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const columns: Column<Pedido>[] = [
    {
      header: 'Cliente',
      primary: true,
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
      full: true,
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/pedidos/${row.id}`}
              title="Ver el detalle del pedido"
              aria-label={`Ver detalle del pedido de ${row.clientes?.nombre ?? 'cliente'}`}
            >
              <IconVer />
              <span className="hidden sm:inline">Ver</span>
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
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
