'use client';

import { IconAgregar, IconBuscar } from '@/client/components/icons';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageShell } from '@/client/components/layout/page-shell';
import { ErrorState } from '@/client/components/shared/error-state';
import { Button } from '@/client/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/client/components/ui/dialog';
import { Input } from '@/client/components/ui/input';
import { Alert } from '@/client/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/client/components/ui/select';
import { endpoints } from '@/client/lib/api/endpoints';
import { orderStatuses } from '@/client/lib/constants';
import { useApi } from '@/client/hooks/use-api';
import { useAtajos } from '@/client/hooks/use-atajos';
import { OrderForm } from '@/client/features/pedidos/order-form';
import { OrdersTable } from '@/client/features/pedidos/orders-table';
import { ETIQUETA_ESTADO } from '@/client/components/shared/status-badge';
import type { PedidoEstado } from '@/client/types/models';

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

  // Los dos gestos que mas repite el dueño, sin cruzar la pantalla con el
  // raton: buscar un cliente y capturar un pedido.
  const campoBusqueda = useRef<HTMLInputElement>(null);
  useAtajos(
    useMemo(
      () => ({
        '/': () => campoBusqueda.current?.focus(),
        n: () => setOpen(true)
      }),
      []
    )
  );
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
            ref={campoBusqueda}
            className="pl-9"
            placeholder="Buscar cliente o telefono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {/* El atajo se enseña donde se usa. Un atajo que nadie descubre no
              existe, y una lista de atajos en un menu de ayuda tampoco. */}
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-sm border border-rule px-1.5 py-0.5 text-2xs text-muted-foreground md:block">
            /
          </kbd>
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
            {/* La misma palabra que la insignia de la fila. El enum crudo
                decia "completado" mientras la fila decia "entregado". */}
            {orderStatuses.map((item) => (
              <SelectItem key={item} value={item}>
                {ETIQUETA_ESTADO[item]}
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
        enLote
      />
        </>
      )}
    </PageShell>
  );
}
