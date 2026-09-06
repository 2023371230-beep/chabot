'use client';

import { IconEditar } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import { cn } from '@/lib/utils';
import type { Cliente } from '@/types/models';

/**
 * Tabla de clientes.
 *
 * Antes tenia cinco columnas y tres no comunicaban nada: `Direccion` repetia
 * "Sin direccion" en cada fila, `Notas` repetia "Sin notas" y `Estado` decia
 * "activo" en todas. Una columna cuyo valor es identico en todas las filas no
 * es informacion, es ruido que empuja lo importante contra el borde.
 *
 * Ahora la direccion y las notas solo aparecen cuando existen, debajo del
 * nombre, que es donde se leen sin ocupar una columna entera. Un cliente
 * inactivo se distingue por el nombre atenuado y una marca discreta, sin
 * necesidad de una columna dedicada a decir "todo normal".
 */
export function ClientsTable({
  clients,
  loading,
  onEdit
}: {
  clients: Cliente[];
  loading?: boolean;
  onEdit: (client: Cliente) => void;
}) {
  const columns: Column<Cliente>[] = [
    {
      header: 'Cliente',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium', !row.activo && 'text-muted-foreground')}>
              {row.nombre ?? 'Sin nombre'}
            </span>
            {!row.activo ? (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
                inactivo
              </span>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{row.telefono}</div>
        </div>
      )
    },
    {
      header: 'Datos de entrega',
      cell: (row) =>
        row.direccion || row.notas ? (
          <div className="min-w-0 text-sm">
            {row.direccion ? <div className="truncate">{row.direccion}</div> : null}
            {row.notas ? (
              <div className="truncate text-xs text-muted-foreground">{row.notas}</div>
            ) : null}
          </div>
        ) : (
          // Un guion en vez de "Sin direccion": comunica lo mismo sin gritar la
          // ausencia en cada fila.
          <span className="text-muted-foreground">—</span>
        )
    },
    {
      header: 'Acciones',
      className: 'text-right',
      full: true,
      cell: (row) => (
        // Con texto, no solo el icono. Editar es la accion que se usa a diario
        // y era la menos descubrible de la fila.
        <Button
          variant="outline"
          size="sm"
          title={`Editar ${row.nombre ?? row.telefono}`}
          onClick={() => onEdit(row)}
        >
          <IconEditar />
          Editar
        </Button>
      )
    }
  ];

  return (
    <DataTable
      data={clients}
      columns={columns}
      loading={loading}
      emptyTitle="Sin clientes"
      emptyDescription="Crea clientes para acelerar los pedidos recurrentes."
    />
  );
}
