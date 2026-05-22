'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
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
  const orders = useApi(() => endpoints.pedidos.list(), []);
  const products = useApi(() => endpoints.productos.list(), []);
  const clients = useApi(() => endpoints.clientes.list(), []);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [status, setStatus] = useState<PedidoEstado | 'todos'>('todos');
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');

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
    try {
      const result = await endpoints.pedidos.create(payload);
      setWarnings(result.warnings ?? []);
      result.warnings?.forEach((warning) => toast.warning(warning));
      toast.success('Pedido creado');
      setOpen(false);
      await orders.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Control de pedidos por kilogramo con estados e impacto de inventario al confirmar."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
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
                clients={clients.data ?? []}
                products={(products.data ?? []).filter((p) => p.activo)}
                warnings={warnings}
                submitting={submitting}
                onSubmit={create}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 grid gap-3 rounded-2xl border border-border bg-card p-3 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
  );
}
