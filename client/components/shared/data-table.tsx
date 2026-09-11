'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconBandeja, IconChevron } from '@/client/components/icons';
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
   * En movil, este dato va en el RESUMEN de la ficha — lo que se ve sin tocar.
   *
   * Marcar aunque sea una columna convierte la ficha en desplegable: el
   * resumen (principal + estas columnas) queda a la vista para escanear, y el
   * resto del detalle y las acciones se abren al tocar. Es la divulgacion
   * progresiva de Apple: lo comun primero, lo demas un nivel mas adentro. Sin
   * ninguna marcada, la ficha muestra todo de golpe como siempre.
   */
  resumenMovil?: boolean;
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
  // Que fichas de movil estan abiertas. Empiezan cerradas: el valor de una
  // lista es poder escanearla, y todo desplegado de entrada es la lista larga
  // de siempre.
  const [abiertas, setAbiertas] = useState<Set<React.Key>>(new Set());
  const quieto = useReducedMotion();

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

  const alternarAbierta = (clave: React.Key): void => {
    setAbiertas((prev) => {
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

  // Divulgacion progresiva: si alguna columna se marco para el resumen, la
  // ficha de movil se pliega. Lo marcado se ve sin tocar (para escanear); el
  // resto del detalle y las acciones se abren al tocar. Sin nada marcado, la
  // ficha sigue mostrando todo de golpe — cero cambio para las demas listas.
  const resumen = datos.filter((c) => c.resumenMovil);
  const detalle = datos.filter((c) => !c.resumenMovil);
  const desplegable = resumen.length > 0;

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

      {/* Movil: mas aire que en la tabla — `gap-2.5 p-2.5` — porque el espacio
          es lo que hace que una lista deje de sentirse como un panel de
          administracion y empiece a sentirse como una app. */}
      <div className="scroll-y flex min-h-0 flex-1 flex-col gap-2.5 p-2.5 md:hidden">
        {filas.map((row) => {
          const clave = resolveRowKey(row);
          const abierta = abiertas.has(clave);
          const hayBloque = (desplegable ? detalle : datos).length > 0 || acciones.length > 0;

          // El bloque de detalle + acciones. Cuando la ficha es desplegable
          // vive dentro del panel que se abre; cuando no, va siempre visible.
          const campos = desplegable ? detalle : datos;
          const detalleYAcciones = (
            <>
              {campos.length ? (
                // Etiqueta a la IZQUIERDA, valor a la DERECHA, alineados a la
                // linea base. Antes era una cuadricula con la etiqueta encima
                // del valor: cada dato empezaba a un ancho distinto y nada caia
                // en una columna, asi que el ojo no podia recorrer los numeros.
                // Con el valor pegado al borde derecho, los precios y los kilos
                // forman una vertical que se lee de un vistazo.
                <dl className="space-y-1.5">
                  {campos.map((column) => (
                    <div
                      key={column.header}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <dt className="label shrink-0">{column.header}</dt>
                      <dd className="min-w-0 text-right text-sm">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {acciones.length ? (
                <div className={cn('flex flex-col gap-2', campos.length && 'mt-3')}>
                  {acciones.map((column) => (
                    <div key={column.header} className="w-full">
                      {column.cell(row)}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          );

          return (
            <article
              key={clave}
              className={cn(
                'overflow-hidden rounded-lg border bg-surface',
                elegidas.has(clave) ? 'border-primary/60 bg-primary/5' : 'border-border'
              )}
            >
              <div className="flex items-start gap-2.5 p-3">
                {accionesEnLote ? (
                  <input
                    type="checkbox"
                    checked={elegidas.has(clave)}
                    onChange={() => alternarFila(clave)}
                    aria-label="Seleccionar este renglon"
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-primary"
                  />
                ) : null}

                {desplegable ? (
                  // El nombre (que suele ser el enlace al detalle completo)
                  // sigue navegando; el chevron despliega el resumen aqui
                  // mismo. Dos accesos que no se pisan: el vistazo rapido con
                  // el pulgar y la ficha completa cuando de verdad hace falta.
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="min-w-0 flex-1 text-sm font-medium">{principal.cell(row)}</div>
                    {resumen.length ? (
                      // El resumen va a la DERECHA, en columna: el numero clave
                      // (el total) cae pegado al borde y forma la vertical que
                      // deja comparar una tarjeta con otra sin leer cada cifra.
                      // Antes iba debajo del nombre, suelto a media tarjeta.
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {resumen.map((column) => (
                          <div key={column.header} className="text-right text-sm">
                            {column.cell(row)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {/* 44x44 completos de area de toque — la medida del pulgar
                        de Apple — sin agrandar el icono: los margenes negativos
                        absorben el tamaño extra en el padding de la ficha para
                        que no empuje la maqueta. `active:` responde en el
                        momento del toque, no al soltar. */}
                    <button
                      type="button"
                      onClick={() => alternarAbierta(clave)}
                      aria-expanded={abierta}
                      aria-label={abierta ? 'Ocultar detalle' : 'Ver detalle'}
                      className="-my-2.5 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-md transition-colors active:bg-muted/50"
                    >
                      <IconChevron
                        className={cn(
                          'text-muted-foreground transition-transform duration-200',
                          abierta && 'rotate-180'
                        )}
                      />
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 text-sm font-medium">{principal.cell(row)}</div>
                )}
              </div>

              {desplegable ? (
                <AnimatePresence initial={false}>
                  {abierta ? (
                    <motion.div
                      key="detalle"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      // Resorte critico (sin rebote) para un panel que no se
                      // arrastro: aparece firme, no saltarin. Con "menos
                      // movimiento" activado, se abre sin animar.
                      transition={quieto ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.35 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-rule px-3 pb-3 pt-2.5">{detalleYAcciones}</div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              ) : hayBloque ? (
                <div className="border-t border-rule px-3 pb-3 pt-2.5">{detalleYAcciones}</div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
