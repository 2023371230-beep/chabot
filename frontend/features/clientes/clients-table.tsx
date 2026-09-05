'use client';

import { IconEditar } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import type { Cliente } from '@/types/models';

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
        <div>
          <div className="font-medium">{row.nombre ?? 'Sin nombre'}</div>
          <div className="text-xs text-muted-foreground">{row.telefono}</div>
        </div>
      )
    },
    { header: 'Direccion', cell: (row) => row.direccion ?? 'Sin direccion' },
    { header: 'Notas', cell: (row) => row.notas ?? 'Sin notas' },
    {
      header: 'Estado',
      cell: (row) => (
        <Badge variant={row.activo ? 'success' : 'danger'}>
          {row.activo ? 'activo' : 'inactivo'}
        </Badge>
      )
    },
    {
      header: 'Acciones',
      className: 'text-right',
      full: true,
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          title={`Editar ${row.nombre ?? row.telefono}`}
          aria-label={`Editar ${row.nombre ?? row.telefono}`}
          onClick={() => onEdit(row)}
        >
          <IconEditar />
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
