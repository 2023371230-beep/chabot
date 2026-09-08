'use client';

import { useMemo, useState } from 'react';
import { IconBandeja } from '@/client/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/client/components/ui/table';
import { cn } from '@/client/lib/utils';
import { EmptyState } from './empty-state';
import { LoadingSkeleton } from './loading-skeleton';

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Se muestra como titulo de la ficha en movil, sin su etiqueta. */
  primary?: boolean;
  /** Ocupa el ancho completo al final de la ficha (tipico de acciones). */
  full?: boolean;
  /** Se oculta en la ficha de movil por redundante. */
  hideOnMobile?: boolean;
  /**
   * Valor por el que se ordena al pulsar el encabezado.
   *
   * Sin esto la columna no se ordena, y es a proposito: una columna de
   * acciones o una de badges no tiene un orden que signifique nada, y poner
   * flechitas en todas entrena al ojo a ignorarlas.
   */
  ordenar?: (row: T) => string | number | null | undefined;
};

type Sentido = 'asc' | 'desc';

/**
 * Tabla en escritorio, fichas en movil.
 *
 * El scroll horizontal en un telefono esconde columnas sin avisar: los
 * botones de accion quedaban fuera de pantalla y el pedido no se podia
 * confirmar desde el celular. Abajo de 768px cada fila se vuelve una ficha
 * con todo visible.
 *
 * Ordenar y seleccionar viven AQUI y no en cada tabla: son la diferencia
 * entre repasar una lista y trabajarla, y si cada pantalla los implementara
 * por su cuenta acabarian comportandose distinto en cada una.
 */
export function DataTable<T>({
  data,
  columns,
  loading,
  emptyTitle = 'Sin datos',
  emptyDescription,
  emptyAction,
  minWidth = '720px',
  getRowKey,
  accionesEnLote
}: {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  minWidth?: string;
  getRowKey?: (row: T) => React.Key;
  /**
   * Con esto cada fila trae casilla y aparece una barra con lo que se puede
   * hacer sobre lo seleccionado. `limpiar` deselecciona todo: se llama
   * despues de actuar, para que la barra no quede prometiendo acciones sobre
   * filas que ya cambiaron.
   */
  accionesEnLote?: (filas: T[], limpiar: () => void) => React.ReactNode;
}) {
  const [orden, setOrden] = useState<{ header: string; sentido: Sentido } | null>(null);
  const [elegidas, setElegidas] = useState<Set<React.Key>>(new Set());

  const resolveRowKey = (row: T): React.Key => {
    if (getRowKey) return getRowKey(row);
    if (row && typeof row === 'object') {
      const c = row as { id?: React.Key; producto_id?: React.Key; created_at?: React.Key };
      if (c.id) return c.id;
      if (c.producto_id) return c.producto_id;
      if (c.created_at) return c.created_at;
    }
    return JSON.stringify(row);
  };

  const filas = useMemo(() => {
    if (!orden) return data;
    const col = columns.find((c) => c.header === orden.header);
    if (!col?.ordenar) return data;
    const signo = orden.sentido === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = col.ordenar!(a);
      const vb = col.ordenar!(b);
      // Los vacios siempre al final, ordene como ordene: un hueco no es "lo
      // mas pequeño", es la ausencia de dato y no compite por el primer lugar.
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * signo;
      return String(va).localeCompare(String(vb), 'es') * signo;
    });
  }, [data, columns, orden]);

  const alternarOrden = (header: string): void => {
    setOrden((prev) => {
      if (prev?.header !== header) return { header, sentido: 'asc' };
      if (prev.sentido === 'asc') return { header, sentido: 'desc' };
      // Tercer toque: se vuelve al orden natural de la pantalla, que en
      // Pedidos es "lo que sale primero". Sin esta salida, quien ordena por
      // Total ya no puede recuperar su lista de trabajo.
      return null;
    });
  };

  const limpiar = (): void => setElegidas(new Set());

  const alternarFila = (clave: React.Key): void => {
    setElegidas((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  };

  const clavesVisibles = filas.map(resolveRowKey);
  const todasElegidas = clavesVisibles.length > 0 && clavesVisibles.every((k) => elegidas.has(k));
  const seleccionadas = filas.filter((f) => elegidas.has(resolveRowKey(f)));

  if (loading) return <LoadingSkeleton />;
  if (!data.length) {
    return (
      <EmptyState
        icon={IconBandeja}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  const principal = columns.find((c) => c.primary) ?? columns[0];
  const acciones = columns.filter((c) => c.full);
  const datos = columns.filter((c) => c !== principal && !c.full && !c.hideOnMobile);

  return (
    <>
      {/* La barra solo existe cuando hay algo elegido. Una barra siempre
          visible con los botones apagados ocupa sitio para no ofrecer nada. */}
      {accionesEnLote && seleccionadas.length > 0 ? (
        <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-3 rounded-md border border-primary/40 bg-primary/10 px-3 py-2">
          <span className="text-sm font-medium">
            {seleccionadas.length}{' '}
            {seleccionadas.length === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {accionesEnLote(seleccionadas, limpiar)}
          </div>
          <button
            type="button"
            onClick={limpiar}
            className="ml-auto rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Quitar seleccion
          </button>
        </div>
      ) : null}

      {/* Escritorio */}
      <div className="scroll-y hidden min-h-0 flex-1 md:block">
        <div style={{ minWidth }}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {accionesEnLote ? (
                  <TableHead className="w-9">
                    <input
                      type="checkbox"
                      checked={todasElegidas}
                      onChange={() =>
                        setElegidas(todasElegidas ? new Set() : new Set(clavesVisibles))
                      }
                      aria-label="Seleccionar todo lo que se ve"
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </TableHead>
                ) : null}
                {columns.map((column) => (
                  <TableHead key={column.header} className={column.className}>
                    {column.ordenar ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(column.header)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                        aria-label={`Ordenar por ${column.header}`}
                      >
                        {column.header}
                        <span
                          aria-hidden
                          className={cn(
                            'text-2xs',
                            orden?.header === column.header
                              ? 'text-primary'
                              : 'text-muted-foreground/40'
                          )}
                        >
                          {orden?.header === column.header
                            ? orden.sentido === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((row) => {
                const clave = resolveRowKey(row);
                return (
                  <TableRow key={clave} className={elegidas.has(clave) ? 'bg-primary/5' : undefined}>
                    {accionesEnLote ? (
                      <TableCell className="w-9">
                        <input
                          type="checkbox"
                          checked={elegidas.has(clave)}
                          onChange={() => alternarFila(clave)}
                          aria-label="Seleccionar esta fila"
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((column) => (
                      <TableCell key={column.header} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Movil */}
      <div className="scroll-y flex min-h-0 flex-1 flex-col gap-2 p-2 md:hidden">
        {filas.map((row) => {
          const clave = resolveRowKey(row);
          return (
            <article
              key={clave}
              className={cn(
                'rounded-md border bg-surface p-3',
                elegidas.has(clave) ? 'border-primary/60 bg-primary/5' : 'border-border'
              )}
            >
              <div className="flex items-start gap-2.5">
                {accionesEnLote ? (
                  <input
                    type="checkbox"
                    checked={elegidas.has(clave)}
                    onChange={() => alternarFila(clave)}
                    aria-label="Seleccionar este renglon"
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                ) : null}
                <div className="min-w-0 flex-1 text-sm font-medium">{principal.cell(row)}</div>
              </div>

              {datos.length ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-rule pt-2">
                  {datos.map((column) => (
                    <div key={column.header} className="min-w-0">
                      <dt className="label">{column.header}</dt>
                      <dd className={cn('mt-0.5 truncate text-sm')}>{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {acciones.length ? (
                <div className="mt-2.5 flex flex-wrap gap-2 border-t border-rule pt-2.5">
                  {acciones.map((column) => (
                    <div key={column.header} className="w-full">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
