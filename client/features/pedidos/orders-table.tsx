'use client';

import { IconVer } from '@/client/components/icons';
import Link from 'next/link';
import { Button } from '@/client/components/ui/button';
import { DataTable, type Column } from '@/client/components/shared/data-table';
import { StatusBadge } from '@/client/components/shared/status-badge';
import { formatCurrency, formatDate, formatKg } from '@/client/lib/formatters';
import type { Pedido } from '@/client/types/models';
import { OrderStatusActions } from './order-status-actions';

/** Hoy a medianoche, para comparar contra `fecha_entrega` sin la hora. */
const hoy = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Ordena por CUANDO SE ENTREGA, no por cuando se capturo.
 *
 * La base devuelve los pedidos por `created_at desc`, que es el orden en que
 * entraron al sistema. Pero nadie abre esta pantalla preguntando "¿cual anote
 * al ultimo?" — la abre preguntando "¿que sale hoy?". Con el orden de captura,
 * un pedido de hace tres dias sin entregar queda sepultado a media lista,
 * debajo de otro que no sale hasta la semana que viene.
 *
 * Los que no tienen fecha van al final: no compiten por atencion con los que
 * si tienen compromiso. Entre dos del mismo dia manda el mas viejo, que es el
 * que lleva mas tiempo esperando.
 */
const porFechaDeEntrega = (a: Pedido, b: Pedido): number => {
  if (a.fecha_entrega !== b.fecha_entrega) {
    if (!a.fecha_entrega) return 1;
    if (!b.fecha_entrega) return -1;
    return a.fecha_entrega.localeCompare(b.fecha_entrega);
  }
  return a.created_at.localeCompare(b.created_at);
};

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
  const ordenados = [...orders].sort(porFechaDeEntrega);
  const dia = hoy();

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
    {
      header: 'Entrega',
      cell: (row) => {
        // Un pedido vencido o de hoy se marca; los demas no. Marcar todo es no
        // marcar nada, y lo unico que el dueño necesita ver de un vistazo es
        // que se le esta pasando.
        const vencido = Boolean(
          row.fecha_entrega &&
            row.fecha_entrega < dia &&
            row.estado !== 'completado' &&
            row.estado !== 'cancelado'
        );
        const esHoy = row.fecha_entrega === dia;
        if (!vencido && !esHoy) return formatDate(row.fecha_entrega);
        return (
          <span className={vencido ? 'font-medium text-danger' : 'font-medium'}>
            {vencido ? 'Atrasado · ' : 'Hoy · '}
            {formatDate(row.fecha_entrega)}
          </span>
        );
      }
    },
    { header: 'Estado', cell: (row) => <StatusBadge estado={row.estado} /> },
    // Las cifras a la derecha y en la fuente tabular: es lo que alinea los
    // decimales en vertical y deja comparar una columna de dinero de un
    // vistazo. Antes iban a la izquierda aqui y a la derecha en Reportes.
    {
      header: 'Kg',
      className: 'text-right font-num',
      cell: (row) => formatKg(row.total_kg)
    },
    {
      header: 'Total',
      className: 'text-right font-num',
      cell: (row) => formatCurrency(row.total_precio)
    },
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
      data={ordenados}
      columns={columns}
      loading={loading}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
