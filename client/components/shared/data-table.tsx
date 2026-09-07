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
};

/**
 * Tabla en escritorio, fichas en movil.
 *
 * El scroll horizontal en un telefono esconde columnas sin avisar: los
 * botones de accion quedaban fuera de pantalla y el pedido no se podia
 * confirmar desde el celular. Abajo de 768px cada fila se vuelve una ficha
 * con todo visible.
 */
export function DataTable<T>({
  data,
  columns,
  loading,
  emptyTitle = 'Sin datos',
  emptyDescription,
  emptyAction,
  minWidth = '720px',
  getRowKey
}: {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  minWidth?: string;
  getRowKey?: (row: T) => React.Key;
}) {
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

  const principal = columns.find((c) => c.primary) ?? columns[0];
  const acciones = columns.filter((c) => c.full);
  const datos = columns.filter(
    (c) => c !== principal && !c.full && !c.hideOnMobile
  );

  return (
    <>
      {/* Escritorio */}
      <div className="scroll-y hidden min-h-0 flex-1 md:block">
        <div style={{ minWidth }}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column.header} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={resolveRowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.header} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Movil */}
      <div className="scroll-y flex min-h-0 flex-1 flex-col gap-2 p-2 md:hidden">
        {data.map((row) => (
          <article
            key={resolveRowKey(row)}
            className="rounded-md border border-border bg-surface p-3"
          >
            <div className="text-sm font-medium">{principal.cell(row)}</div>

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
        ))}
      </div>
    </>
  );
}
