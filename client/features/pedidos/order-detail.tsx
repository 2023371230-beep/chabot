'use client';

import { IconCalendario, IconPedidos, IconTelefono } from '@/client/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
import { DataTable, type Column } from '@/client/components/shared/data-table';
import { MetricCard } from '@/client/components/shared/metric-card';
import { StatusBadge } from '@/client/components/shared/status-badge';
import { ConversacionDelPedido } from '@/client/features/pedidos/conversacion-del-pedido';
import { formatCurrency, formatDate, formatKg } from '@/client/lib/formatters';
import type { Pedido, PedidoDetalle } from '@/client/types/models';

/**
 * El origen, en palabras del negocio.
 *
 * "dashboard" y "manual" son nombres de la base de datos: no le dicen nada a
 * quien lee la ficha. Lo que necesita saber es si ese pedido lo tomo el bot o
 * lo capturo una persona.
 */
const ORIGEN: Record<string, string> = {
  whatsapp: 'Llego por WhatsApp',
  dashboard: 'Lo capturaste tu aqui',
  manual: 'Por telefono o en persona'
};

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
        {/* Los productos y la conversacion van juntos en la columna ancha: el
            "que se pidio" y el "por que se pidio asi" son la misma pregunta,
            y separarlos obligaria a mirar a dos sitios para responderla. */}
        <div className="flex flex-col gap-6">
          {/* Sin `CardContent` alrededor de la tabla: metia un tercer nivel de
              caja y empujaba la tabla hacia adentro, al reves de como se ve en
              Productos e Inventario. La tabla va directo en la tarjeta. */}
          <Card>
            <CardHeader>
              <CardTitle>Productos del pedido</CardTitle>
            </CardHeader>
            <DataTable data={details} columns={columns} minWidth="480px" />
          </Card>

          <ConversacionDelPedido pedido={order} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Cliente y estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* El estado va PRIMERO: es lo unico de esta columna que decide
                que se puede hacer con el pedido. Antes estaba en tercer lugar,
                debajo del telefono. */}
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <div className="mt-1">
                <StatusBadge estado={order.estado} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{cliente?.nombre ?? 'Sin nombre'}</p>
            </div>
            <div className="flex items-center gap-2">
              <IconTelefono className="h-4 w-4 text-muted-foreground" />
              <span>{cliente?.telefono ?? 'Sin telefono'}</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Origen</p>
              <p>{ORIGEN[order.origen] ?? order.origen}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Notas</p>
              <p>{order.notas ?? 'Sin notas'}</p>
            </div>
            {/* Sin la caja gris alrededor: era una tarjeta dentro de otra para
                dos fechas. Y sin "Timeline", que era la unica palabra en
                ingles de toda la interfaz. */}
            <div className="border-t border-rule pt-3 text-xs text-muted-foreground">
              <p>Creado: {formatDate(order.created_at)}</p>
              <p className="mt-1">Actualizado: {formatDate(order.updated_at)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
