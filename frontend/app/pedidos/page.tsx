'use client';

import { IconAgregar, IconBuscar } from '@/components/icons';
import { useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { endpoints } from '@/lib/api/endpoints';
import { orderStatuses } from '@/lib/constants';
import { useApi } from '@/hooks/use-api';
import { OrderForm } from '@/features/pedidos/order-form';
import { OrdersTable } from '@/features/pedidos/orders-table';
import type { PedidoEstado } from '@/types/models';

export default function PedidosPage() {
  const orders = useApi(() => endpoints.pedidos.list(), [], 'pedidos');
  const products = useApi(() => endpoints.productos.list(), [], 'productos');
  const clients = useApi(() => endpoints.clientes.list(), [], 'clientes');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pageWarnings, setPageWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<PedidoEstado | 'todos'>('todos');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const error = orders.error ?? products.error ?? clients.error;

  const filteredOrders = useMemo(() => {
    return (orders.data ?? []).filter((order) => {
      const clientName =
        `${order.clientes?.nombre ?? ''} ${order.clientes?.telefono ?? ''}`.toLowerCase();
      const byStatus = status === 'todos' || order.estado === status;
      const byQuery = !query || clientName.includes(query.toLowerCase());
      const byDate = !date || order.fecha_entrega === date;
      return byStatus && byQuery && byDate;
    });
  }, [date, orders.data, query, status]);

  const create = async (payload: unknown) => {
    setSubmitting(true);
    setWarnings([]);
    setPageWarnings([]);
    try {
      const result = await endpoints.pedidos.create(payload);
      setWarnings(result.warnings ?? []);
      setPageWarnings(result.warnings ?? []);
      result.warnings?.forEach((warning) => toast.warning(warning));
      toast.success(result.warnings?.length ? 'Pedido creado con advertencia' : 'Pedido creado');
      setOpen(false);
      await orders.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear pedido');
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      fill
        title="Pedidos"
        description="Control de pedidos por kilogramo con estados e impacto de inventario al confirmar."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setWarnings([])}>
                <IconAgregar className="h-4 w-4" />
                Nuevo pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Nuevo pedido</DialogTitle>
                <DialogDescription>
                  El backend calcula precios, totales y advertencias de mayoreo.
                </DialogDescription>
              </DialogHeader>
              <OrderForm
                onCancel={() => setOpen(false)}
                clients={clients.data ?? []}
                products={(products.data ?? []).filter((p) => p.activo)}
                warnings={warnings}
                submitting={submitting}
                onSubmit={create}
              />
            </DialogContent>
          </Dialog>
        }
    >      {error ? (
        <ErrorState
          title="No se pudieron cargar los pedidos"
          description={error}
          onRetry={async () => {
            await Promise.all([orders.refetch(), products.refetch(), clients.refetch()]);
          }}
        />
      ) : (
        <>
      {pageWarnings.length ? (
        <Alert className="mb-4">
          <ul className="list-disc space-y-1 pl-4">
            {pageWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <div className="mb-4 grid gap-3 border-2 border-border bg-card p-3 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <IconBuscar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente o telefono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as PedidoEstado | 'todos')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {orderStatuses.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <OrdersTable
        orders={filteredOrders}
        loading={orders.loading}
        onUpdated={orders.refetch}
      />
        </>
      )}
    </PageShell>
  );
}
