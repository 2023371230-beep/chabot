'use client';

import { IconAgregar } from '@/components/icons';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import type { Cliente } from '@/types/models';
import { ClientForm, type ClientFormValues } from '@/features/clientes/client-form';
import { ClientsTable } from '@/features/clientes/clients-table';

export default function ClientesPage() {
  const { data, loading, error, refetch } = useApi(() => endpoints.clientes.list(), [], 'clientes');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const save = async (values: ClientFormValues) => {
    setSubmitting(true);
    try {
      if (editing) await endpoints.clientes.update(editing.id, values);
      else await endpoints.clientes.create(values);
      toast.success(editing ? 'Cliente actualizado' : 'Cliente creado');
      setOpen(false);
      setEditing(null);
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      fill
        title="Clientes"
        description="Base de clientes para pedidos manuales, dashboard y futuros mensajes de WhatsApp."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <IconAgregar className="h-4 w-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
                <DialogDescription>
                  El telefono es unico y permite reconocer clientes desde WhatsApp.
                </DialogDescription>
              </DialogHeader>
              <ClientForm
                onCancel={() => setOpen(false)} client={editing} onSubmit={save} submitting={submitting} />
            </DialogContent>
          </Dialog>
        }
    >     {error ? (
        <ErrorState
          title="No se pudieron cargar los clientes"
          description={error}
          onRetry={refetch}
        />
      ) : (
        <ClientsTable
          clients={data ?? []}
          loading={loading}
          onEdit={(client) => {
            setEditing(client);
            setOpen(true);
          }}
        />
      )}
    </PageShell>
  );
}
