'use client';

import { useMemo, useState } from 'react';
import { IconAlerta, IconBascula, IconClientes, IconPedidos } from '@/components/icons';
import { PageShell } from '@/components/layout/page-shell';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { endpoints } from '@/lib/api/endpoints';
import { useApi } from '@/hooks/use-api';
import { formatCurrency, formatKg } from '@/lib/formatters';
import { PERIODOS, calcular, rangos, type Periodo } from '@/features/reportes/reportes-data';
import { VentasDetalle } from '@/features/reportes/ventas-detalle';

/** Indicador con comparacion contra el periodo anterior del mismo largo. */
function Indicador({
  etiqueta,
  valor,
  variacion,
  hayPrevio,
  ayuda,
  icono: Icono
}: {
  etiqueta: string;
  valor: string;
  variacion: number | null;
  hayPrevio: boolean;
  ayuda: string;
  icono: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number }>;
}) {
  const sube = (variacion ?? 0) > 0;
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="label">{etiqueta}</span>
        <Icono className="shrink-0 text-muted-foreground/60" />
      </div>
      <div className="num mt-1.5 text-xl font-semibold leading-none">{valor}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        {hayPrevio && variacion !== null ? (
          <span
            className={cn(
              'num rounded-full px-1.5 py-0.5 text-2xs font-semibold',
              sube ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
            )}
          >
            {sube ? '+' : ''}
            {variacion.toFixed(0)}%
          </span>
        ) : null}
        <span className="text-2xs text-muted-foreground">
          {hayPrevio && variacion !== null ? 'vs. periodo anterior' : 'Sin periodo previo'}
        </span>
      </div>
      <p className="mt-2 border-t border-rule pt-2 text-2xs leading-snug text-muted-foreground">
        {ayuda}
      </p>
    </Card>
  );
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [vista, setVista] = useState<'resumen' | 'detalle'>('resumen');
  const orders = useApi(() => endpoints.pedidos.list(), []);
  const inventory = useApi(() => endpoints.inventario.resumen(), []);

  const loading = orders.loading || inventory.loading;
  const error = orders.error ?? inventory.error;

  const d = useMemo(
    () => calcular(orders.data ?? [], inventory.data ?? [], periodo),
    [orders.data, inventory.data, periodo]
  );

  const pedidosDelPeriodo = useMemo(() => {
    const { desde, hasta } = rangos(periodo);
    return (orders.data ?? []).filter((p) => {
      const f = new Date(p.created_at);
      return f >= desde && f < hasta;
    });
  }, [orders.data, periodo]);

  const maxIngreso = d.productos[0]?.ingreso ?? 0;
  const tasaCancelacion = d.totalPeriodo ? (d.cancelados / d.totalPeriodo) * 100 : 0;

  return (
    <PageShell
      fill
      title="Reportes"
      description="Cuanto vendiste, que se vende mas y quien te compra."
      action={
        <>
          <div role="group" aria-label="Vista del reporte" className="flex rounded-md bg-muted p-0.5">
            {([
              ['resumen', 'Resumen'],
              ['detalle', 'Ventas detalladas']
            ] as const).map(([v, etiqueta]) => (
              <button
                key={v}
                type="button"
                aria-pressed={vista === v}
                onClick={() => setVista(v)}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                  vista === v
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        <div
          role="group"
          aria-label="Periodo del reporte"
          className="flex rounded-md bg-muted p-0.5"
        >
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              type="button"
              title={p.explica}
              aria-pressed={periodo === p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                periodo === p.valor
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
        </>
      }
    >
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState
          title="No se pudieron cargar los reportes"
          description={error}
          onRetry={async () => {
            await Promise.all([orders.refetch(), inventory.refetch()]);
          }}
        />
      ) : vista === 'detalle' ? (
        <Card className="min-h-0 flex-1">
          <VentasDetalle pedidos={pedidosDelPeriodo} />
        </Card>
      ) : (
        <div className="scroll-y flex min-h-0 flex-1 flex-col gap-3">
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador
              etiqueta="Ingresos"
              valor={formatCurrency(d.ingreso)}
              variacion={d.varIngreso}
              hayPrevio={d.hayPrevio}
              ayuda="Lo que cobraste en pedidos confirmados y entregados."
              icono={IconBascula}
            />
            <Indicador
              etiqueta="Kilos vendidos"
              valor={formatKg(d.kg)}
              variacion={d.varKg}
              hayPrevio={d.hayPrevio}
              ayuda="Peso total que salio del almacen en ese periodo."
              icono={IconBascula}
            />
            <Indicador
              etiqueta="Pedidos"
              valor={String(d.pedidos)}
              variacion={d.varPedidos}
              hayPrevio={d.hayPrevio}
              ayuda="Cuantos pedidos llegaron a confirmarse."
              icono={IconPedidos}
            />
            <Indicador
              etiqueta="Ticket promedio"
              valor={formatCurrency(d.ticket)}
              variacion={null}
              hayPrevio={false}
              ayuda="Cuanto deja un pedido en promedio. Sirve para saber si conviene empujar pedidos mas grandes."
              icono={IconClientes}
            />
          </div>

          <div className="grid min-h-[220px] flex-1 gap-3 xl:grid-cols-2">
            <Card className="min-h-0">
              <CardHeader>
                <CardTitle>Que se vende mas</CardTitle>
                <span className="text-2xs text-muted-foreground">Por ingreso</span>
              </CardHeader>
              {d.productos.length ? (
                <ul className="scroll-y flex min-h-0 flex-1 flex-col divide-y divide-rule">
                  {d.productos.slice(0, 8).map((f) => (
                    <li key={f.nombre} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-24 shrink-0 truncate text-sm font-medium">
                        {f.nombre}
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{
                            width: maxIngreso
                              ? `${Math.max(3, (f.ingreso / maxIngreso) * 100)}%`
                              : '0%'
                          }}
                        />
                      </span>
                      <span className="num w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {formatKg(f.kg)}
                      </span>
                      <span className="num w-24 shrink-0 text-right text-sm font-medium">
                        {formatCurrency(f.ingreso)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay ventas en este periodo.
                </p>
              )}
            </Card>

            <Card className="min-h-0">
              <CardHeader>
                <CardTitle>Quien te compra mas</CardTitle>
                <span className="text-2xs text-muted-foreground">Por ingreso</span>
              </CardHeader>
              {d.clientes.length ? (
                <ul className="scroll-y flex min-h-0 flex-1 flex-col divide-y divide-rule">
                  {d.clientes.slice(0, 8).map((c) => (
                    <li
                      key={c.telefono}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{c.nombre}</div>
                        <div className="num truncate text-2xs text-muted-foreground">
                          {c.telefono}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="num text-sm font-medium">
                          {formatCurrency(c.ingreso)}
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay clientes con compras en este periodo.
                </p>
              )}
            </Card>
          </div>

          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="label">Pedidos cancelados</span>
                <IconPedidos className="text-muted-foreground/60" />
              </div>
              <div className="num mt-1.5 text-xl font-semibold leading-none">
                {d.cancelados}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  de {d.totalPeriodo}
                </span>
              </div>
              <p className="mt-2 border-t border-rule pt-2 text-2xs leading-snug text-muted-foreground">
                {tasaCancelacion > 20
                  ? `${tasaCancelacion.toFixed(0)}% de los pedidos se cancelan. Vale la pena revisar por que.`
                  : 'Proporcion de pedidos que no llegaron a entregarse.'}
              </p>
            </Card>

            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="label">Merma acumulada</span>
                <IconAlerta className="text-danger/70" />
              </div>
              <div className="num mt-1.5 text-xl font-semibold leading-none text-danger">
                {formatCurrency(d.merma.dinero)}
              </div>
              <p className="mt-2 border-t border-rule pt-2 text-2xs leading-snug text-muted-foreground">
                {formatKg(d.merma.kg)} registrados como merma, valuados a precio de venta.
                Este dato es historico completo, no del periodo seleccionado.
              </p>
            </Card>
          </div>

          <p className="flex items-start gap-2 rounded-md border border-border bg-surface-2/60 p-3 text-2xs leading-snug text-muted-foreground">
            <IconAlerta className="mt-px shrink-0" />
            <span>
              Todo esto son <strong className="font-semibold">ingresos</strong>, no
              ganancia. Para saber cuanto ganas de verdad falta registrar cuanto te cuesta
              cada kilo; con ese dato estos mismos reportes muestran margen.
            </span>
          </p>
        </div>
      )}
    </PageShell>
  );
}
