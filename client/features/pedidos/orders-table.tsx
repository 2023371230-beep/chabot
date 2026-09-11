'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { IconCheck, IconVer } from '@/client/components/icons';
import { Button } from '@/client/components/ui/button';
import { ConfirmDialog } from '@/client/components/shared/confirm-dialog';
import { DataTable, type Column } from '@/client/components/shared/data-table';
import { StatusBadge } from '@/client/components/shared/status-badge';
import { endpoints } from '@/client/lib/api/endpoints';
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
  emptyDescription = 'Crea el primero desde el boton de arriba o espera a que entre por WhatsApp.',
  enLote = false,
  ocultarEstado = false
}: {
  orders: Pedido[];
  loading?: boolean;
  onUpdated?: () => Promise<void> | void;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * Casillas y confirmacion en lote. Apagado por defecto: en el Inicio, que
   * es un resumen de cinco filas, las casillas serian ruido — ahi se entra a
   * mirar, no a trabajar la lista.
   */
  enLote?: boolean;
  /**
   * Quita la columna Estado.
   *
   * En una lista titulada "Pedidos por confirmar" esa columna dice
   * "pendiente" en todas las filas: no informa, y entrena al ojo a saltarse
   * la zona. Se oculta solo cuando de verdad es redundante, no siempre.
   */
  ocultarEstado?: boolean;
}) {
  const ordenados = [...orders].sort(porFechaDeEntrega);
  const dia = hoy();

  const columns: Column<Pedido>[] = [
    {
      header: 'Cliente',
      primary: true,
      ordenar: (row) => row.clientes?.nombre ?? row.cliente?.nombre ?? '',
      // El nombre ES el enlace al detalle. En movil el unico acceso era un
      // icono de ojo gris sin etiqueta, junto a dos botones grandes de color:
      // habia que decidir "¿confirmo y descuento 35 kg?" sin poder ver de que
      // producto son esos kilos, a menos que se adivinara que ese ojo llevaba
      // a algun lado.
      cell: (row) => (
        <Link
          href={`/pedidos/${row.id}`}
          className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="font-medium">
            {row.clientes?.nombre ?? row.cliente?.nombre ?? 'Cliente'}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.clientes?.telefono ?? row.cliente?.telefono}
          </div>
        </Link>
      )
    },
    {
      header: 'Entrega',
      ordenar: (row) => row.fecha_entrega,
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
    {
      header: 'Estado',
      // Al resumen de la ficha de movil: el estado es lo primero que se mira
      // para saber si un pedido pide accion, y tiene que verse sin desplegar.
      resumenMovil: true,
      ordenar: (row) => row.estado,
      cell: (row) => <StatusBadge estado={row.estado} />
    },
    // Las cifras a la derecha y en la fuente tabular: es lo que alinea los
    // decimales en vertical y deja comparar una columna de dinero de un
    // vistazo. Antes iban a la izquierda aqui y a la derecha en Reportes.
    {
      header: 'Kg',
      className: 'text-right font-num',
      ordenar: (row) => Number(row.total_kg),
      cell: (row) => formatKg(row.total_kg)
    },
    {
      header: 'Total',
      className: 'text-right font-num',
      // Tambien al resumen: cuanto es, junto al estado, es lo que el dueño lee
      // de un vistazo antes de decidir si abre el pedido.
      resumenMovil: true,
      ordenar: (row) => Number(row.total_precio),
      cell: (row) => <span className="font-num">{formatCurrency(row.total_precio)}</span>
    },
    {
      header: 'Acciones',
      className: 'text-right',
      full: true,
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          {/* En movil no va: el nombre del cliente ya lleva al detalle, y un
              ojo gris compitiendo con Confirmar y Cancelar en la zona del
              pulgar solo invita a errarle. En escritorio se queda, con su
              palabra al lado. */}
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
            <Link
              href={`/pedidos/${row.id}`}
              title="Ver el detalle del pedido"
              aria-label={`Ver detalle del pedido de ${row.clientes?.nombre ?? 'cliente'}`}
            >
              <IconVer />
              Ver
            </Link>
          </Button>
          <OrderStatusActions order={row} onUpdated={onUpdated} />
        </div>
      )
    }
  ];

  const visibles = ocultarEstado ? columns.filter((c) => c.header !== 'Estado') : columns;

  return (
    <DataTable
      data={ordenados}
      columns={visibles}
      loading={loading}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      accionesEnLote={
        enLote
          ? (filas, limpiar) => (
              <ConfirmarEnLote pedidos={filas} onUpdated={onUpdated} onListo={limpiar} />
            )
          : undefined
      }
    />
  );
}

/**
 * Confirmar varios pedidos de una vez.
 *
 * Cinco pedidos pendientes eran cinco botones mas cinco dialogos: diez
 * interacciones para una cosa que el dueño piensa como una sola — "abrir el
 * dia". En temporada alta con veinte son cuarenta.
 *
 * El dialogo sigue existiendo, y suma los kilos de TODO el lote: es la unica
 * cifra que importa antes de mover inventario, y verla junta es mas seguro
 * que verla cinco veces por separado.
 */
function ConfirmarEnLote({
  pedidos,
  onUpdated,
  onListo
}: {
  pedidos: Pedido[];
  onUpdated?: () => Promise<void> | void;
  onListo: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const pendientes = pedidos.filter((p) => p.estado === 'pendiente');
  const kg = pendientes.reduce((t, p) => t + Number(p.total_kg), 0);

  if (!pendientes.length) {
    // Se dice por que no se puede, en vez de esconder el boton: un boton que
    // desaparece deja al usuario pensando que la seleccion no funciono.
    return (
      <span className="text-xs text-muted-foreground">
        Ninguno de los seleccionados esta por confirmar.
      </span>
    );
  }

  const confirmar = async (): Promise<void> => {
    setEnviando(true);
    let hechos = 0;
    const fallidos: string[] = [];

    // En serie y no en paralelo a proposito: cada confirmacion descuenta
    // stock del mismo almacen, y lanzarlas todas a la vez hace que compitan
    // por las mismas filas. En serie, si el tercero se queda sin producto,
    // los dos primeros ya quedaron bien y se dice exactamente cual fallo.
    for (const p of pendientes) {
      try {
        const r = await endpoints.pedidos.updateStatus(p.id, 'confirmado');
        r.warnings?.forEach((w) => toast.warning(w));
        hechos += 1;
      } catch (e) {
        fallidos.push(p.clientes?.nombre ?? p.cliente?.nombre ?? p.id.slice(0, 8));
      }
    }

    setEnviando(false);
    if (hechos) toast.success(`${hechos} ${hechos === 1 ? 'pedido confirmado' : 'pedidos confirmados'}.`);
    if (fallidos.length) toast.error(`No se pudo con: ${fallidos.join(', ')}.`);
    onListo();
    await onUpdated?.();
  };

  return (
    <ConfirmDialog
      title={`Confirmar ${pendientes.length} ${pendientes.length === 1 ? 'pedido' : 'pedidos'}`}
      description={`Se van a descontar ${formatKg(kg)} del stock en total. Si te equivocas, cancelarlos no regresa el stock solo: tendrias que hacer un ajuste manual en Inventario.`}
      confirmLabel={`Si, descontar ${formatKg(kg)}`}
      variant="primary"
      onConfirm={() => void confirmar()}
      trigger={
        <Button variant="primary" size="sm" disabled={enviando}>
          <IconCheck />
          {enviando ? 'Confirmando...' : `Confirmar ${pendientes.length}`}
        </Button>
      }
    />
  );
}
