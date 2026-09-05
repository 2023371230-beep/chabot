'use client';

import { IconCalendario, IconPedidos, IconTelefono } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { MetricCard } from '@/components/shared/metric-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate, formatKg } from '@/lib/formatters';
import type { Pedido, PedidoDetalle } from '@/types/models';

export function OrderDetail({ order }: { order: Pedido }) {
  const details = order.pedido_detalles ?? order.detalles ?? [];
  const cliente = order.clientes ?? order.cliente;
  const columns: Column<PedidoDetalle>[] = [
    { header: 'Producto', cell: (row) => row.productos?.nombre ?? row.producto?.nombre ?? row.producto_id },
    { header: 'Kg', cell: (row) => formatKg(row.kg) },
    { header: 'Precio kg', cell: (row) => formatCurrency(row.precio_kg) },
    { header: 'Subtotal', cell: (row) => formatCurrency(row.subtotal) }
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Total kg" value={formatKg(order.total_kg)} icon={IconPedidos} />
        <MetricCard title="Total" value={formatCurrency(order.total_precio)} icon={IconPedidos} variant="success" />
        <MetricCard title="Entrega" value={formatDate(order.fecha_entrega)} icon={IconCalendario} variant="info" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Productos del pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable data={details} columns={columns} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cliente y estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{cliente?.nombre ?? 'Sin nombre'}</p>
            </div>
            <div className="flex items-center gap-2">
              <IconTelefono className="h-4 w-4 text-muted-foreground" />
              <span>{cliente?.telefono ?? 'Sin telefono'}</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <div className="mt-1">
                <StatusBadge estado={order.estado} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Origen</p>
              <p>{order.origen}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Notas</p>
              <p>{order.notas ?? 'Sin notas'}</p>
            </div>
            <div className="bg-muted/40 p-4 text-sm">
              <p className="font-medium">Timeline</p>
              <div className="mt-3 space-y-2 text-muted-foreground">
                <p>Creado: {formatDate(order.created_at)}</p>
                <p>Actualizado: {formatDate(order.updated_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
