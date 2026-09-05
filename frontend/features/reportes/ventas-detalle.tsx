'use client';

import { useMemo, useState } from 'react';
import { IconBuscar } from '@/components/icons';
import { StatusBadge } from '@/components/shared/status-badge';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDateTime, formatKg } from '@/lib/formatters';
import type { Pedido } from '@/types/models';

/**
 * Ventas transaccion por transaccion: el "minuto a minuto" del negocio.
 *
 * El resumen contesta "cuanto vendi"; esta tabla contesta "que exactamente se
 * llevo cada quien y cuando". Son preguntas distintas, por eso viven en
 * vistas separadas en vez de amontonarse en la misma pantalla.
 */
export function VentasDetalle({ pedidos }: { pedidos: Pedido[] }) {
  const [busqueda, setBusqueda] = useState('');

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return pedidos
      .filter((p) => p.estado === 'confirmado' || p.estado === 'completado')
      .filter((p) => {
        if (!q) return true;
        const cliente = (p.clientes?.nombre ?? p.cliente?.nombre ?? '').toLowerCase();
        const tel = (p.clientes?.telefono ?? p.cliente?.telefono ?? '').toLowerCase();
        const productos = (p.pedido_detalles ?? [])
          .map((d) => d.productos?.nombre ?? '')
          .join(' ')
          .toLowerCase();
        return (
          cliente.includes(q) ||
          tel.includes(q) ||
          productos.includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      })
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [pedidos, busqueda]);

  const totalFiltrado = filas.reduce((s, p) => s + Number(p.total_precio ?? 0), 0);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-rule px-3 py-2">
        <div className="relative w-full max-w-xs">
          <IconBuscar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cliente, telefono, producto o ticket"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar en las ventas"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="label">
            {filas.length} {filas.length === 1 ? 'venta' : 'ventas'}
          </span>
          <span className="num text-md font-semibold">{formatCurrency(totalFiltrado)}</span>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="px-3 py-10 text-center text-xs text-muted-foreground">
          {busqueda
            ? 'Ninguna venta coincide con esa busqueda.'
            : 'No hay ventas confirmadas en este periodo.'}
        </p>
      ) : (
        <div className="scroll-y min-h-0 flex-1">
          {/* Escritorio: tabla con encabezado pegajoso */}
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr className="[&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-2xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-muted-foreground">
                <th>Ticket</th>
                <th>Fecha y hora</th>
                <th>Cliente</th>
                <th>Que se llevo</th>
                <th className="text-right">Kg</th>
                <th className="text-right">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-rule align-top transition-colors last:border-b-0 hover:bg-accent/60"
                >
                  <td className="num px-3 py-2 text-xs text-muted-foreground">
                    {/* Los primeros 8 del UUID bastan para identificarlo de voz */}
                    {p.id.slice(0, 8)}
                  </td>
                  <td className="num px-3 py-2 text-xs">{formatDateTime(p.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {p.clientes?.nombre ?? p.cliente?.nombre ?? 'Cliente'}
                    </div>
                    <div className="num text-2xs text-muted-foreground">
                      {p.clientes?.telefono ?? p.cliente?.telefono}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ul className="flex flex-col gap-0.5">
                      {(p.pedido_detalles ?? []).map((d) => (
                        <li key={d.id} className="flex gap-2 text-xs">
                          <span className="num w-16 shrink-0 text-muted-foreground">
                            {formatKg(d.kg)}
                          </span>
                          <span className="truncate">{d.productos?.nombre ?? '—'}</span>
                          <span className="num ml-auto shrink-0 text-muted-foreground">
                            {formatCurrency(d.subtotal)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="num px-3 py-2 text-right">{formatKg(p.total_kg)}</td>
                  <td className="num px-3 py-2 text-right font-semibold">
                    {formatCurrency(p.total_precio)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge estado={p.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Movil: una ficha por venta */}
          <div className="flex flex-col gap-2 p-2 md:hidden">
            {filas.map((p) => (
              <article key={p.id} className="rounded-md border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {p.clientes?.nombre ?? p.cliente?.nombre ?? 'Cliente'}
                    </div>
                    <div className="num text-2xs text-muted-foreground">
                      {formatDateTime(p.created_at)} · {p.id.slice(0, 8)}
                    </div>
                  </div>
                  <StatusBadge estado={p.estado} />
                </div>
                <ul className="mt-2 flex flex-col gap-1 border-t border-rule pt-2">
                  {(p.pedido_detalles ?? []).map((d) => (
                    <li key={d.id} className="flex items-baseline gap-2 text-xs">
                      <span className="num w-14 shrink-0 text-muted-foreground">
                        {formatKg(d.kg)}
                      </span>
                      <span className="truncate">{d.productos?.nombre ?? '—'}</span>
                      <span className="num ml-auto shrink-0">
                        {formatCurrency(d.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-baseline justify-between border-t border-rule pt-2">
                  <span className="label">Total</span>
                  <span className="num text-md font-semibold">
                    {formatCurrency(p.total_precio)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
